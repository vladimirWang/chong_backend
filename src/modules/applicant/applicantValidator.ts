import { z } from "zod";

/** 申请（获取邀请码）入参
 *  join  型：email + tenantCode（加入已有租户，由该租户 superUser 审核）
 *  create 型：email + tenantName（新建租户，由系统管理员审核）
 */
export const sendInviteCodeBodySchema = z.object({
  email: z.email(),
  tenantCode: z.string().optional(),
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
