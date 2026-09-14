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

/** 通过激活 token 注册的入参
 *  新流程：申请时已确定租户（applicant.tenantId 或 applicant.tenantName），
 *         激活时只需 token + username + password
 *  兼容：旧流程在激活时传 tenantOption/tenantCode/tenantName
 */
export const registerByTokenBodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
  username: z.string().max(8),
  tenantOption: z.enum(["join", "create"]).optional(),
  tenantName: z.string().optional(),
  tenantCode: z.string().optional(),
});

export type RegisterByTokenBody = z.infer<typeof registerByTokenBodySchema>;
