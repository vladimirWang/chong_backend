import { z } from "zod";

export const createMultipleStockOutSchema = z.object({
  productJoinStockOut: z.array(
    z.object({
      price: z.number(),
      count: z.number(),
      productId: z.number(),
      vendorId: z.number(),
    }),
  ),
  remark: z.string().optional(),
  createdAt: z.string().optional(),
  platformId: z.number(),
  platformOrderNo: z.string(),
  clientId: z.number().optional(),
});

export type CreateMultipleStockOut = z.infer<createMultipleStockOutSchema>;

// 批量出货 Body Schema（更新用）
export const multipleStockOutBodySchema = z.object({
  remark: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  clientId: z.number().optional().nullable(),
  platformId: z.number().optional(),
  platformOrderNo: z.string().optional(),
  productJoinStockOut: z.array(
    z.object({
      count: z.number(),
      price: z.number(),
      productId: z.number(),
      vendorId: z.number(),
    }),
  ),
});

export type MultipleStockOutBody = z.infer<typeof multipleStockOutBodySchema>;
