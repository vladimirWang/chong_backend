import { z } from "zod";

// 注册用户 Body Schema
export const registerUserBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().max(8),
  verifyCode: z.string(),
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

// 上传文件 Body Schema（multipart/form-data）
export const uploadFileBodySchema = z.object({
  hash: z.string().min(1, "hash 不能为空"),
  file: z.instanceof(File, { message: "请上传文件" }),
});

export type UploadFileBody = z.infer<typeof uploadFileBodySchema>;
