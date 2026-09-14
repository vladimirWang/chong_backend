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

/** 通过激活 token 注册的入参（与前端 RegisterForm.tsx 对齐）
 *  tenantOption=join   加入已有租户：必传 tenantCode（租户编码）
 *  tenantOption=create 自建租户：必传 tenantName
 */
export const registerByTokenBodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
  username: z.string().max(8),
  tenantOption: z.enum(["join", "create"]),
  tenantName: z.string().optional(),
  tenantCode: z.string().optional(),
});

export type RegisterByTokenBody = z.infer<typeof registerByTokenBodySchema>;
