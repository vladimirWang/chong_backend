import { z } from "zod";
import { paginationSchema } from "../../validators/commonValidator";

/** 批量进货/更新进货单 body 中的单个产品行 */
export const stockInLineSchema = z.object({
  count: z.number(),
  cost: z.number(),
  productId: z.number(),
  vendorId: z.number(),
});

/** POST /stockin/multiple、PUT /stockin/:id body（移植自老架构） */
export const multipleStockInBodySchema = z.object({
  productJoinStockIn: z.array(stockInLineSchema),
  submittedAt: z.string().optional(),
  remark: z.string().optional(),
});
export type MultipleStockInBody = z.infer<typeof multipleStockInBodySchema>;

/** GET /stockin 列表 query（stockOut 列表复用） */
export const stockInQuerySchema = z
  .object({
    productName: z.string().optional(),
    deletedStart: z.coerce.date().optional(),
    deletedEnd: z.coerce.date().optional(),
    vendorName: z.string().optional(),
    completedStart: z.coerce.date().optional(),
    completedEnd: z.coerce.date().optional(),
    // 老架构为必填 "1"/"0"，这里放宽为可选（缺省只看未删除）
    isDeleted: z.literal("1").or(z.literal("0")).optional(),
  })
  .merge(paginationSchema);
export type StockInQuery = z.infer<typeof stockInQuerySchema>;

/** 批量删除 query：id 数组直接通过，单个数字转为长度 1 的数组 */
export const batchDeleteStockInQuerySchema = z
  .union([
    z.object({ id: z.array(z.coerce.number()) }),
    z.object({ id: z.coerce.number() }),
  ])
  .transform((val) => (typeof val.id === "number" ? { id: [val.id] } : val));
export type BatchDeleteStockInQuery = z.infer<
  typeof batchDeleteStockInQuerySchema
>;
