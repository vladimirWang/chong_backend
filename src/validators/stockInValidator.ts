import { z } from "zod";

// 单个进货 Body Schema
export const singleStockInBodySchema = z.object({
  count: z.number(),
  cost: z.number(),
  productId: z.number(),
  remark: z.string().optional(),
});

export type SingleStockInBody = z.infer<typeof singleStockInBodySchema>;

// 批量进货 Body Schema
export const multipleStockInBodySchema = z.object({
  remark: z.string().optional(),
  joinData: z.array(
    z.object({
      count: z.number(),
      cost: z.number(),
      productId: z.number(),
    })
  ),
});

export type MultipleStockInBody = z.infer<typeof multipleStockInBodySchema>;

// 进货记录参数 Schema
export const stockInParamsSchema = z.object({
  id: z.coerce.number(),
});

export type StockInParams = z.infer<typeof stockInParamsSchema>;
