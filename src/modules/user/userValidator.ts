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
