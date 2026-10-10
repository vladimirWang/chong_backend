import { z } from "zod";

/** 路径参数邮箱校验 */
export const paramEmailSchema = z.object({
  email: z.email(),
});

export type ParamEmail = z.infer<typeof paramEmailSchema>;

/** SSO 授权码换 token 入参（前端 SSO 回调页提交；redirectUri 须与发起授权时完全一致） */
export const ssoExchangeBodySchema = z.object({
  code: z.string().min(1),
  redirectUri: z.string().url(),
});
export type SsoExchangeBody = z.infer<typeof ssoExchangeBodySchema>;
