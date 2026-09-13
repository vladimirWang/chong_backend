import { z } from "zod";
import { stockInQuerySchema } from "../stockIn/stockInValidator";

/** 出货明细行 */
export const stockOutLineSchema = z.object({
  price: z.number(),
  count: z.number(),
  productId: z.number(),
  vendorId: z.number(),
});

/**
 * 平台规则（移植自老架构）：
 * - platformId=1（线下/无平台）：platformOrderNo 可填可不填
 * - 其它平台：platformOrderNo 必填
 */
const platform1Schema = z.object({
  platformId: z.literal(1),
  platformOrderNo: z.string().optional(),
});
const otherPlatformSchema = z.object({
  platformId: z
    .number()
    .refine((id) => id !== 1, "当填写platformOrderNo时，platformId 不能为1"),
  platformOrderNo: z.string(),
});
export const platformSchema = z.union([platform1Schema, otherPlatformSchema]);

const baseCreateMultipleStockOutSchema = z.object({
  productJoinStockOut: z.array(stockOutLineSchema),
  remark: z.string().optional(),
  submittedAt: z.string().optional(),
  clientId: z.number().optional(),
  docs: z.array(z.string()).optional(), // 单据：多个文件地址（URL 或路径）
});

/** POST /stockout/multiple body */
export const createMultipleStockOutSchema = baseCreateMultipleStockOutSchema.and(
  platformSchema,
);
export type CreateMultipleStockOut = z.infer<
  typeof createMultipleStockOutSchema
>;

/** PUT /stockout/:id body（更新用；clientId 传 null 表示解绑客户） */
export const multipleStockOutBodySchema = z.object({
  remark: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  clientId: z.number().optional().nullable(),
  platformId: z.number().optional(),
  platformOrderNo: z.string().optional(),
  productJoinStockOut: z.array(stockOutLineSchema),
  docs: z.array(z.string()).optional(),
});
export type MultipleStockOutBody = z.infer<typeof multipleStockOutBodySchema>;

/** 出货列表 query 与进货列表一致 */
export const stockOutQuerySchema = stockInQuerySchema;
export type StockOutQuery = z.infer<typeof stockOutQuerySchema>;
