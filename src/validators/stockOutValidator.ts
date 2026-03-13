import { z } from "zod";

// 拆分两种场景的 Schema，通过 union 合并
const Platform1Schema = z.object({
  platformId: z.literal(1),
  // platformOrderNo: z.never().optional(),
});

const OtherPlatformSchema = z.object({
  platformId: z
    .number()
    .refine((id) => id !== 1, "当填写platformOrderNo时，platformId 不能为1"),
  platformOrderNo: z.string(), // 强制必填
});

export const platformSchema = z.union([Platform1Schema, OtherPlatformSchema]);
export const baseCreateMultipleStockOutSchema = z.object({
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
  clientId: z.number().optional(),
  docs: z.array(z.string()).optional(), // 单据：多个文件地址（URL 或路径）
});

export const createMultipleStockOutSchema = z.intersection(
  baseCreateMultipleStockOutSchema,
  platformSchema,
);

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
  docs: z.array(z.string()).optional(), // 单据：多个文件地址
});

export type MultipleStockOutBody = z.infer<typeof multipleStockOutBodySchema>;
