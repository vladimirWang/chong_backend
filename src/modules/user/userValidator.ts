import { z } from "zod";

/** 登录入参（与 repo_backend loginUserBodySchema 一致） */
export const loginBodySchema = z.object({
  email: z.email(),
  password: z.string(),
  captchaId: z.string(),
  captchaText: z.string(),
  nonce: z.string(),
});

export type LoginBody = z.infer<typeof loginBodySchema>;

/** 路径参数邮箱校验（与 repo_backend paramEmailSchema 一致） */
export const paramEmailSchema = z.object({
  email: z.email(),
});

export type ParamEmail = z.infer<typeof paramEmailSchema>;

/** 修改密码入参（需登录，与 adminUserValidator.updatePasswordBodySchema 一致） */
export const updatePasswordBodySchema = z.object({
  current: z.string().min(6),
  password: z.string().min(6),
  nonce: z.string(),
});
export type UpdatePasswordBody = z.infer<typeof updatePasswordBodySchema>;

/** 通过激活 token 注册入参
 *  租户归属在申请/审核阶段已确定（applicant.tenantId 必有值），
 *  激活时只需提交 token + username + password
 */
export const registerByTokenBodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
  username: z.string().max(8),
});

export type RegisterByTokenBody = z.infer<typeof registerByTokenBodySchema>;
