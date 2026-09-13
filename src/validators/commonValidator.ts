import { z } from "zod";

/** :id 路径参数（query/path 都是字符串，需要 coerce） */
export const updateIdSchema = z.object({
  id: z.coerce.number(),
});
export type UpdateId = z.infer<typeof updateIdSchema>;

/** 通用分页 query */
export const paginationSchema = z.object({
  pagination: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  page: z.coerce.number().optional(),
});
export type Pagination = z.infer<typeof paginationSchema>;

/** :vendorId 路径参数 */
export const vendorIdSchema = z.object({
  vendorId: z.coerce.number(),
});
export type VendorId = z.infer<typeof vendorIdSchema>;

/** productName query 参数 */
export const productNameStringSchema = z.object({
  productName: z.string(),
});
export type ProductNameString = z.infer<typeof productNameStringSchema>;

/** 确认完成 body：completedAt 可选（缺省由 service 取当前时间） */
export const completedAtSchema = z.object({
  completedAt: z.coerce.date().optional(),
});
export type CompletedAt = z.infer<typeof completedAtSchema>;

/** 批量恢复 body */
export const idArray = z.object({
  ids: z.array(z.coerce.number()),
});
export type IdArray = z.infer<typeof idArray>;
