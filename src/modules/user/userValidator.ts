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

/** 通过激活 token 注册的入参
 *  新流程：加入租户或自建租户（tenantCode  + tenantOption为join或 tenantName + tenantOption为create），
 *         基础字段 token + username + password
 */
// 基础字段
const registerByTokenBaseSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
  username: z.string().max(8),
})
// 加入已有租户
const registerByTokenOptionJoin = z.object({
  tenantOption: z.enum(["join"]),
  tenantCode: z.string(),
})
// 自建租户
const registerByTokenOptionCreate = z.object({
  tenantOption: z.enum(["create"]),
  tenantName: z.string()
})
// 二选一
export const registerByTokenBodySchema = z.xor([
  registerByTokenBaseSchema.extend(registerByTokenOptionJoin.shape),
  registerByTokenBaseSchema.extend(registerByTokenOptionCreate.shape),
])

export type RegisterByTokenBody = z.infer<typeof registerByTokenBodySchema>;
