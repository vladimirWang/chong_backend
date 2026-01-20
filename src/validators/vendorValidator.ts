import { z } from "zod";

// 定义 getVendors 查询参数的 Schema
export const vendorQuerySchema = z.object({
  pagination: z.coerce.boolean().optional(),
  limit: z.coerce.number().optional(),
  page: z.coerce.number().optional(),
  name: z.string().optional(),
});

// 从 Schema 推断 TypeScript 类型
export type VendorQuery = z.infer<typeof vendorQuerySchema>;
