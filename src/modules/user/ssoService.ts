import { sign } from "hono/jwt";
import prisma from "../../utils/prisma";
import { redisClient } from "../../utils/redis";
import {
  ErrorResponse,
  SuccessResponse,
  errorCode,
} from "../../models/Response";
import { createModuleLogger } from "../../utils/logger";
import type { JwtPayload } from "./userService";

const logger = createModuleLogger("sso");

/** SSO POST /oauth/token 响应中的 userinfo（sso_login 服务返回） */
interface SsoUserinfo {
  userId: number;
  email: string;
  username: string | null;
  // tenantId/role/isSuperUser 是 SSO 自身账户模型的字段，本系统不作为授权依据
  tenantId?: number;
  role?: string;
  isSuperUser?: boolean;
  exp?: number;
}

interface SsoTokenResp {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  userinfo?: SsoUserinfo;
  error?: string;
  error_description?: string;
}

/**
 * SSO 登录换取本系统会话（公共路由）
 * 1. 校验 redirectUri 白名单
 * 2. 服务端用 code + client 凭证调 SSO POST /oauth/token 换 userinfo
 * 3. 按 email 匹配本地 User（仅查已有用户，不自动开通）
 * 4. 签发本系统 JWT（username 来自 SSO userinfo）并写 redis
 */
export async function ssoExchange(code: string, redirectUri: string) {
  // 1. redirectUri 白名单校验
  const allowed = (process.env.SSO_REDIRECT_URIS ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  if (!allowed.includes(redirectUri)) {
    logger.warn(`SSO 回跳地址不在白名单: ${redirectUri}`);
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "非法的回跳地址");
  }

  // 2. code 换 userinfo
  let data: SsoTokenResp;
  try {
    const resp = await fetch(`${process.env.SSO_BASE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.SSO_CLIENT_ID!,
        client_secret: process.env.SSO_CLIENT_SECRET!,
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });
    data = (await resp.json()) as SsoTokenResp;
  } catch (error) {
    logger.error(`SSO token 交换请求失败: ${error instanceof Error ? error.message : String(error)}`);
    return new ErrorResponse(errorCode.SYSTEM_ERROR, "SSO 服务暂不可用，请稍后重试");
  }
  if (!data.access_token || !data.userinfo?.email) {
    logger.warn(`SSO token 交换被拒绝: ${data.error ?? ""} ${data.error_description ?? ""}`);
    return new ErrorResponse(
      errorCode.VALIDATION_ERROR,
      data.error_description || "SSO 授权失败，请重新登录",
    );
  }

  // 3. 按 email 匹配本地用户（SSO 仅作身份源，不自动开通）
  const localUser = await prisma.user.findUnique({
    where: { email: data.userinfo.email },
  });
  if (!localUser) {
    return new ErrorResponse(
      errorCode.USER_NOT_FOUND,
      "该邮箱未在本系统开通，请先完成注册激活",
    );
  }

  // 4. 查 Tenant.superUserId 判断是否租户超级管理员
  const isSuperUser = await prisma.tenant
    .findFirst({
      where: { superUserId: localUser.id },
      select: { id: true },
    })
    .then(t => t !== null);

  // 5. 签发本系统 JWT（username 来自 SSO userinfo，非本地 User 表）
  const payload: JwtPayload = {
    userId: localUser.id,
    email: localUser.email,
    username: data.userinfo.username,
    tenantId: localUser.tenantId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    role: "merchant",
    isSuperUser,
  };
  const token = await sign(payload, process.env.JWT_SECRET!);
  await redisClient.setEx(`token:${token}`, 60 * 60 * 24, JSON.stringify(payload));

  return new SuccessResponse<string>(token, "SSO 登录成功");
}
