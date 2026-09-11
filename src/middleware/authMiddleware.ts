import type { MiddlewareHandler } from "hono";
import { redisClient } from "../utils/redis";
import type { AuthUser } from "../types/auth";

/** 无需登录的公共路由（与 repo_backend auth.macro.ts 的 publicRoutes 对齐，随接口迁移追加） */
const publicRoutes = new Set([
  "/nodejs_api/user/login",
  "/nodejs_api/user/getSalt/:email",
  "/nodejs_api/util/captcha",
  "/nodejs_api/util/get-nonce",
]);

/**
 * 登录态校验中间件（移植自 repo_backend isSignIn 宏）
 * 与老架构一致：authorization header 存 token 原文（非 Bearer），
 * 有效性以 redis token:{token} 是否存在为准（登出即失效，JWT 不重复验签）
 */
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  // 公共路由不鉴权
  if (publicRoutes.has(c.req.path) || c.req.path.startsWith("/nodejs_api/public")) {
    await next();
    return;
  }

  const token = c.req.header("authorization");
  if (!token) return c.body(null, 401);

  const userInfoStr = await redisClient.get(`token:${token}`);
  if (!userInfoStr) return c.body(null, 401);

  try {
    const user = JSON.parse(userInfoStr) as AuthUser;
    if (!user) return c.body(null, 401);
    c.set("user", user);
  } catch {
    return c.body(null, 401);
  }
  await next();
};
