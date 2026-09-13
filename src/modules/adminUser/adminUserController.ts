import type { Context } from "hono";
import {
  checkAdminEmailExisted,
  checkAdminEmailNotExisted,
  checkFileExistedByHash,
  getAdminUserSaltByEmail,
  loginAdminUser,
  registerAdminUser,
  registerAdminUserShortCut,
  resetAdminPassword,
  updateAdminPassword,
} from "./adminUserService";
import type {
  LoginBody,
  ParamEmail,
  ParamHash,
  RegisterBody,
  RegisterShortCutBody,
  ResetPasswordBody,
  UpdatePasswordBody,
} from "./adminUserValidator";

/** POST /admin/user/login：管理员登录（公共路由） */
export const loginHandler = async (c: Context) => {
  const body = c.req.valid("json" as never) as LoginBody;
  return c.json(await loginAdminUser(body));
};

/** POST /admin/user/register：管理员注册（公共路由） */
export const registerHandler = async (c: Context) => {
  const body = c.req.valid("json" as never) as RegisterBody;
  return c.json(await registerAdminUser(body));
};

/** POST /admin/user/registerShortCut：快捷创建管理员（公共路由） */
export const registerShortCutHandler = async (c: Context) => {
  const body = c.req.valid("json" as never) as RegisterShortCutBody;
  return c.json(await registerAdminUserShortCut(body));
};

/** GET /admin/user/checkEmailExisted/:email（公共路由） */
export const checkEmailExistedHandler = async (c: Context) => {
  const { email } = c.req.valid("param" as never) as ParamEmail;
  return c.json(await checkAdminEmailExisted(email));
};

/** GET /admin/user/checkEmailNotExisted/:email（公共路由） */
export const checkEmailNotExistedHandler = async (c: Context) => {
  const { email } = c.req.valid("param" as never) as ParamEmail;
  return c.json(await checkAdminEmailNotExisted(email));
};

/** GET /admin/user/getSalt/:email（公共路由） */
export const getUserSaltByEmailHandler = async (c: Context) => {
  const { email } = c.req.valid("param" as never) as ParamEmail;
  return c.json(await getAdminUserSaltByEmail(email));
};

/** POST /admin/user/resetPassword：重置密码（公共路由） */
export const resetPasswordHandler = async (c: Context) => {
  const { email } = c.req.valid("json" as never) as ResetPasswordBody;
  return c.json(await resetAdminPassword(email));
};

/** POST /admin/user/updatePassword：修改密码（需登录） */
export const updatePasswordHandler = async (c: Context) => {
  const body = c.req.valid("json" as never) as UpdatePasswordBody;
  return c.json(await updateAdminPassword(body, c.get("user")));
};

/** GET /admin/user/checkFileExisted/:hash：秒传校验（需登录） */
export const checkFileExistedByHashHandler = async (c: Context) => {
  const { hash } = c.req.valid("param" as never) as ParamHash;
  return c.json(await checkFileExistedByHash(hash));
};
