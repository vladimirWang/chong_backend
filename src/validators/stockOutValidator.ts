import { z } from "zod";

export const createMultipleStockOutSchema = z.object({
  productJoinStockOut: z.array(
    z.object({
      price: z.number(),
      count: z.number(),
      productId: z.number(),
    }),
  ),
  remark: z.string().optional(),
});

export type CreateMultipleStockOut = z.infer<createMultipleStockOutSchema>;

// 批量进货 Body Schema
export const multipleStockOutBodySchema = z.object({
  // remark: z.string().optional(),
  productJoinStockOut: z.array(
    z.object({
      count: z.number(),
      price: z.number(),
      productId: z.number(),
    }),
  ),
});

export type MultipleStockOutBody = z.infer<typeof multipleStockOutBodySchema>;
