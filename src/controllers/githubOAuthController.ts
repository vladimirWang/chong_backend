import { randomBytes } from "node:crypto";
import prisma from "../utils/prisma";
import { redisClient } from "../utils/redis";
import { logger } from "../utils/logger";
import { generateFixedSalt, sha256 } from "../utils/algo";
import type { JwtPayload } from "./userController";
import { ErrorResponse, SuccessResponse, errorCode } from "../models/Response";

const STATE_PREFIX = "oauth:github:state:";
const EXCHANGE_PREFIX = "oauth:github:exchange:";
const STATE_TTL_SEC = 600;
const EXCHANGE_TTL_SEC = 120;
const USER_AGENT = "inventory-app-oauth/1.0";

type GithubStatePayload = {
  redirectAfterLogin?: string;
};

/** 仅允许站内相对路径，防止开放重定向 */
function sanitizeRedirect(raw?: string): string | undefined {
  if (!raw) return undefined;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//") || t.includes("://")) return undefined;
  return t;
}

type ExchangePayload = {
  token: string;
  redirectAfterLogin?: string;
};

function requireGithubEnv(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / GITHUB_REDIRECT_URI 未配置");
  }
  return { clientId, clientSecret, redirectUri };
}

function frontendBaseUrl(): string {
  const u = process.env.FRONTEND_URL?.replace(/\/$/, "");
  if (!u) {
    throw new Error("FRONTEND_URL 未配置");
  }
  return u;
}

function redirectToFrontend(pathWithHashQuery: string): Response {
  try {
    const base = frontendBaseUrl();
    const location = `${base}${pathWithHashQuery.startsWith("/") ? "" : "/"}${pathWithHashQuery}`;
    return new Response(null, { status: 302, headers: { Location: location } });
  } catch {
    return new Response("FRONTEND_URL 未配置，无法完成 OAuth 回跳", { status: 500 });
  }
}

async function exchangeGithubCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<string> {
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(tokenJson.error_description || tokenJson.error || "GitHub 换取 access_token 失败");
  }
  return tokenJson.access_token;
}

async function fetchGithubUser(accessToken: string) {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": USER_AGENT,
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub 用户信息请求失败: ${res.status}`);
  }
  return (await res.json()) as {
    id: number;
    login: string;
    email: string | null;
    avatar_url?: string;
  };
}

async function fetchGithubPrimaryVerifiedEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": USER_AGENT,
    },
  });
  if (!res.ok) {
    return null;
  }
  const emails = (await res.json()) as Array<{
    email: string;
    primary: boolean;
    verified: boolean;
  }>;
  const primary = emails.find((e) => e.primary && e.verified);
  const anyVerified = emails.find((e) => e.verified);
  return (primary ?? anyVerified)?.email ?? null;
}

async function issueMerchantToken(
  user: { id: number; email: string; username: string | null },
  jwt: { sign: (p: JwtPayload) => Promise<string> },
): Promise<string> {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    username: user.username,
    exp: "1d",
    role: "merchant",
  };
  const token = await jwt.sign(payload);
  await redisClient.setEx(`token:${token}`, 60 * 60 * 24, JSON.stringify(payload));
  return token;
}

/** GET /user/oauth/github — 跳转 GitHub 授权页 */
export const startGithubOAuth = async ({
  query,
}: {
  query: { redirect?: string };
}): Promise<Response> => {
  let clientId: string;
  let redirectUri: string;
  try {
    ({ clientId, redirectUri } = requireGithubEnv());
  } catch (e) {
    logger.error(e);
    return redirectToFrontend(
      `/#/landing/oauth/callback?oauth_error=${encodeURIComponent("服务端未配置 GitHub 登录")}`,
    );
  }
  const state = randomBytes(24).toString("hex");
  const payload: GithubStatePayload = {};
  const safeRedirect = sanitizeRedirect(query.redirect);
  if (safeRedirect) {
    payload.redirectAfterLogin = safeRedirect;
  }
  await redisClient.setEx(
    STATE_PREFIX + state,
    STATE_TTL_SEC,
    JSON.stringify(payload),
  );
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", "read:user user:email");
  authorize.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: { Location: authorize.toString() },
  });
};

/** GET /user/oauth/github/callback — GitHub 回跳，换票后重定向前端并下发一次性 exchange */
export const callbackGithubOAuth = async ({
  query,
  jwt,
}: {
  query: {
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  };
  jwt: { sign: (p: JwtPayload) => Promise<string> };
}): Promise<Response> => {
  const errMsg = (msg: string) =>
    redirectToFrontend(`/#/landing/oauth/callback?oauth_error=${encodeURIComponent(msg)}`);

  if (query.error) {
    return errMsg(query.error_description || query.error || "GitHub 授权被拒绝");
  }
  if (!query.code || !query.state) {
    return errMsg("缺少 code 或 state");
  }

  let clientId: string;
  let clientSecret: string;
  let redirectUri: string;
  try {
    ({ clientId, clientSecret, redirectUri } = requireGithubEnv());
  } catch (e) {
    logger.error(e);
    return errMsg("服务端未配置 GitHub 登录");
  }

  const stateKey = STATE_PREFIX + query.state;
  const stateRaw = await redisClient.get(stateKey);
  await redisClient.del(stateKey);
  if (!stateRaw) {
    return errMsg("state 无效或已过期，请重新登录");
  }

  let statePayload: GithubStatePayload = {};
  try {
    statePayload = JSON.parse(stateRaw) as GithubStatePayload;
  } catch {
    /* ignore */
  }

  let accessToken: string;
  try {
    accessToken = await exchangeGithubCode(query.code, clientId, clientSecret, redirectUri);
  } catch (e) {
    logger.error(e);
    return errMsg(e instanceof Error ? e.message : "换取 GitHub 令牌失败");
  }

  let ghUser: Awaited<ReturnType<typeof fetchGithubUser>>;
  try {
    ghUser = await fetchGithubUser(accessToken);
  } catch (e) {
    logger.error(e);
    return errMsg(e instanceof Error ? e.message : "获取 GitHub 用户失败");
  }

  let email = ghUser.email;
  if (!email) {
    email = (await fetchGithubPrimaryVerifiedEmail(accessToken)) ?? null;
  }
  if (!email) {
    return errMsg("无法获取已验证邮箱，请在 GitHub 公开邮箱或授权 user:email");
  }

  const githubIdStr = String(ghUser.id);

  try {
    let user = await prisma.user.findFirst({
      where: { githubId: githubIdStr, deletedAt: null },
    });

    if (!user) {
      const byEmail = await prisma.user.findFirst({
        where: { email, deletedAt: null },
      });
      if (byEmail) {
        if (byEmail.githubId && byEmail.githubId !== githubIdStr) {
          return errMsg("该邮箱已绑定其他 GitHub 账号");
        }
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: {
            githubId: githubIdStr,
            avatar: ghUser.avatar_url ?? byEmail.avatar,
            username: byEmail.username ?? ghUser.login,
          },
        });
      } else {
        const salt = generateFixedSalt();
        const randomSecret = randomBytes(32).toString("hex");
        const passwordHash = sha256(randomSecret + "_" + salt);
        user = await prisma.user.create({
          data: {
            email,
            username: ghUser.login,
            password: passwordHash,
            salt,
            githubId: githubIdStr,
            avatar: ghUser.avatar_url ?? undefined,
          },
        });
      }
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          email,
          username: user.username ?? ghUser.login,
          avatar: ghUser.avatar_url ?? user.avatar,
        },
      });
    }

    const token = await issueMerchantToken(
      { id: user.id, email: user.email, username: user.username },
      jwt,
    );
    const exchangeId = randomBytes(24).toString("hex");
    const exchangeBody: ExchangePayload = {
      token,
      redirectAfterLogin: statePayload.redirectAfterLogin,
    };
    await redisClient.setEx(
      EXCHANGE_PREFIX + exchangeId,
      EXCHANGE_TTL_SEC,
      JSON.stringify(exchangeBody),
    );

    return redirectToFrontend(`/#/landing/oauth/callback?exchange=${encodeURIComponent(exchangeId)}`);
  } catch (e) {
    logger.error(e);
    return errMsg(e instanceof Error ? e.message : "登录处理失败");
  }
};

/** POST /user/oauth/github/exchange — 用一次性 exchange 换取 JWT（写入前端 localStorage 前由前端调用） */
export const exchangeGithubOAuth = async ({
  body,
}: {
  body: { exchange: string };
}) => {
  const key = EXCHANGE_PREFIX + body.exchange;
  const raw = await redisClient.get(key);
  await redisClient.del(key);
  if (!raw) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "exchange 无效或已使用");
  }
  let payload: ExchangePayload;
  try {
    payload = JSON.parse(raw) as ExchangePayload;
  } catch {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "exchange 数据损坏");
  }
  return new SuccessResponse(
    {
      token: payload.token,
      redirect: payload.redirectAfterLogin,
    },
    "GitHub 登录成功",
  );
};
