import { z } from "zod";

/** 更新租户信息入参（name / logo 至少传一个；logo 传 null 表示清除） */
export const updateTenantBodySchema = z
  .object({
    name: z.string().trim().min(1, "租户名称不能为空").max(50, "租户名称最长 50 个字符").optional(),
    logo: z.string().trim().min(1).nullable().optional(),
  })
  .refine((data) => data.name !== undefined || data.logo !== undefined, {
    message: "至少提交一个待更新字段",
  });
export type UpdateTenantBody = z.infer<typeof updateTenantBodySchema>;
