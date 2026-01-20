import { z } from "zod";

// 注册用户 Body Schema
export const registerUserBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type RegisterUserBody = z.infer<typeof registerUserBodySchema>;

// 登录用户 Body Schema
export const loginUserBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginUserBody = z.infer<typeof loginUserBodySchema>;

// 用户参数 Schema
export const userParamsSchema = z.object({
  id: z.coerce.number(),
});

export type UserParams = z.infer<typeof userParamsSchema>;
