import { z } from "zod";

/** 申请（获取邀请码）入参：邮箱 + 可选的新租户名称（创建型场景） */
export const sendInviteCodeBodySchema = z.object({
  email: z.email(),
  tenantName: z.string().optional(),
});
export type SendInviteCodeBody = z.infer<typeof sendInviteCodeBodySchema>;

/** 校验邀请码入参 */
export const checkInviteCodeBodySchema = z.object({
  email: z.email(),
  inviteCode: z.string(),
});
export type CheckInviteCodeBody = z.infer<typeof checkInviteCodeBodySchema>;

/** 审核申请入参 */
export const approveApplicationBodySchema = z.object({
  id: z.coerce.number(),
});
export type ApproveApplicationBody = z.infer<
  typeof approveApplicationBodySchema
>;

/** 路径参数邮箱 */
export const paramEmailSchema = z.object({
  email: z.email(),
});
export type ParamEmail = z.infer<typeof paramEmailSchema>;
