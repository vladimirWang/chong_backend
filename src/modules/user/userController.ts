import type { Context } from "hono";
import {
  checkEmailExisted,
  getCurrentUser,
  logoutUser,
} from "./userService";
import { ssoExchange } from "./ssoService";
import type { SsoExchangeBody } from "./userValidator";

/**
 * HTTP 层：取参、调 service、组装响应
 * 响应体为 SuccessResponse/ErrorResponse 实例（HTTP 恒为 200，业务码看 body.code）
 */

/**
 * GET /user/checkEmailExisted/:email：检查邮箱是否已注册（公共路由，无需登录）
 */
export const checkEmailExistedHandler = async (c: Context) => {
  const email = c.req.param("email")!;
  const result = await checkEmailExisted(email);
  return c.json(result);
};

/**
 * GET /user/current：获取当前登录用户（需登录，user 由 authMiddleware 注入）
 */
export const getCurrentUserHandler = (c: Context) => {
  const result = getCurrentUser(c.get("user"));
  return c.json(result);
};

/**
 * POST /user/logout：登出，删除 redis 中的 token 使其立即失效（需登录）
 */
export const logoutUserHandler = async (c: Context) => {
  const token = c.req.header("authorization")!;
  const result = await logoutUser(token);
  return c.json(result);
};

/**
 * POST /user/sso/exchange：SSO 授权码换本系统 token（公共路由，无需登录）
 */
export const ssoExchangeHandler = async (c: Context) => {
  const body = c.req.valid("json" as never) as SsoExchangeBody;
  return c.json(await ssoExchange(body.code, body.redirectUri));
};
