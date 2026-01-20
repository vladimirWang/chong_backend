import { z } from "zod";

const deletedAtQuerySchema = z.preprocess((val) => {
  // Elysia query 参数通常是 string（或 string[]）。
  const v = Array.isArray(val) ? val[0] : val;
  if (v === undefined || v === null || v === "") return undefined;

  // 只有显式布尔字面量才转 boolean，避免 '2026-01-20' => true
  if (typeof v === "string") {
    const lower = v.toLowerCase();
    if (lower === "true" || lower === "1") return true;
    if (lower === "false" || lower === "0") return false;
  }

  // 其他情况交给 date 解析（支持 Date 或可被 new Date(...) 解析的字符串）
  return v;
}, z.coerce.date().optional());

// 定义 getVendors 查询参数的 Schema
export const vendorQuerySchema = z.object({
  pagination: z.coerce.boolean().optional(),
  limit: z.coerce.number().optional(),
  page: z.coerce.number().optional(),
  name: z.string().optional(),
  deletedAt: z.union([deletedAtQuerySchema, z.boolean().optional()]),
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