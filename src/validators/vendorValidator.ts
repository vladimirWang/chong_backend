import { z } from "zod";

// 定义 getVendors 查询参数的 Schema
export const vendorQuerySchema = z.object({
  pagination: z.coerce.boolean().optional(),
  limit: z.coerce.number().optional(),
  page: z.coerce.number().optional(),
  name: z.string().optional(),
  deletedAt: z.union([z.coerce.boolean().optional(), z.coerce.date().optional()])
});

// 从 Schema 推断 TypeScript 类型
export type VendorQuery = z.infer<typeof vendorQuerySchema>;

// 供应商参数 Schema
export const vendorParamsSchema = z.object({
  id: z.coerce.number(),
});

export type VendorParams = z.infer<typeof vendorParamsSchema>;

export const vendorBatchDeleteSchema = z.object({
    id: z.array(z.number())
  })

export type VendorBatchDelete = z.infer<typeof vendorBatchDeleteSchema>;