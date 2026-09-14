import { z } from "zod";

/** 管理员登录入参（与普通用户登录一致：nonce + 图形验证码） */
export const loginBodySchema = z.object({
  email: z.email(),
  password: z.string(),
  captchaId: z.string(),
  captchaText: z.string(),
  nonce: z.string(),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

/** 管理员注册入参（需邮箱验证码） */
export const registerBodySchema = z.object({
  email: z.email(),
  password: z.string().min(6),
  username: z.string().max(8),
  verifyCode: z.string(),
});
export type RegisterBody = z.infer<typeof registerBodySchema>;

/** 快捷创建管理员入参 */
export const registerShortCutBodySchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});
export type RegisterShortCutBody = z.infer<typeof registerShortCutBodySchema>;

/** 修改密码入参（需登录） */
export const updatePasswordBodySchema = z.object({
  current: z.string().min(6),
  password: z.string().min(6),
  nonce: z.string(),
});
export type UpdatePasswordBody = z.infer<typeof updatePasswordBodySchema>;

/** 重置密码入参（公共路由，只需邮箱） */
export const resetPasswordBodySchema = z.object({
  email: z.email(),
});
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;

/** 路径参数邮箱 */
export const paramEmailSchema = z.object({
  email: z.email(),
});
export type ParamEmail = z.infer<typeof paramEmailSchema>;
