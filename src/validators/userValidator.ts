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
  email: z.email(),
  password: z.string(),
  captchaId: z.string(),
  captchaText: z.string(),
  nonce: z.string(),
});

export type LoginUserBody = z.infer<typeof loginUserBodySchema>;

// 上传文件 Body Schema（multipart/form-data）
export const uploadFileBodySchema = z.object({
  hash: z.string().min(1, "hash 不能为空"),
  file: z.instanceof(File, { message: "请上传文件" }),
});

export type UploadFileBody = z.infer<typeof uploadFileBodySchema>;

// 修改密码 Body Schema
export const updatePasswordBodySchema = z.object({
  current: z.string().min(6),
  password: z.string().min(6),
  nonce: z.string(),
});

export type UpdatePasswordBody = z.infer<typeof updatePasswordBodySchema>;

export const checkInviteCodeBodySchema = z.object({
  email: z.email(),
  inviteCode: z.string(),
});

export type CheckInviteCodeBody = z.infer<typeof checkInviteCodeBodySchema>;
