import { z } from "zod";

// 注册用户 Body Schema
export const registerUserBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().max(8)
});

export type RegisterUserBody = z.infer<typeof registerUserBodySchema>;

// 登录用户 Body Schema
export const loginUserBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(8),
  captchaId: z.string(),
  captchaText: z.string(),
});

export type LoginUserBody = z.infer<typeof loginUserBodySchema>;
