import type { Context } from "hono";
import {
  checkEmailExisted,
  getCurrentUser,
  getUserSaltByEmail,
  loginUser,
  logoutUser,
  registerUserByToken,
  updateUserPassword,
} from "./userService";
import type { LoginBody, RegisterByTokenBody, UpdatePasswordBody } from "./userValidator";

/**
 * HTTP 层：取参（zValidator 已在路由层校验过）、调 service、组装响应
 * 响应体为 SuccessResponse/ErrorResponse 实例（HTTP 恒为 200，业务码看 body.code，与 repo_backend 一致）
 */
export const loginHandler = async (c: Context) => {
  const body: LoginBody = await c.req.json();
  const result = await loginUser(body);
  return c.json(result);
};

/**
 * GET /user/checkEmailExisted/:email：检查邮箱是否已注册（公共路由，无需登录）
 */
export const checkEmailExistedHandler = async (c: Context) => {
  const email = c.req.param("email")!;
  const result = await checkEmailExisted(email);
  return c.json(result);
};

/**
 * GET /user/getSalt/:email：按邮箱取 salt（公共路由，无需登录）
 */
export const getUserSaltByEmailHandler = async (c: Context) => {
  const email = c.req.param("email")!;
  const result = await getUserSaltByEmail(email);
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
 * POST /user/registerByToken：通过激活 token 注册用户（公共路由，无需登录）
 * 前端激活表单提交：token + password + username（租户归属由申请/审核阶段确定）
 */
export const registerUserByTokenHandler = async (c: Context) => {
  const body = c.req.valid("json" as never) as RegisterByTokenBody;
  return c.json(await registerUserByToken(body));
};

/** POST /user/updatePassword：修改密码（需登录，user 由 authMiddleware 注入） */
export const updatePasswordHandler = async (c: Context) => {
  const body = c.req.valid("json" as never) as UpdatePasswordBody;
  return c.json(await updateUserPassword(body, c.get("user")));
};
