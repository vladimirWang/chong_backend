import { z } from "zod";
import { paginationSchema } from "./commonValidator";

// deletedAt query 既可能用于“是否已删除”(boolean)，也可能用于“按日期过滤”(date)。
// 注意：Elysia 的 query 参数通常是 string；直接 z.coerce.boolean() 会把任何非空字符串都转成 true，
// 比如 '2026-01-20T09:21:35.415Z' => true，从而导致 date 分支永远不生效。
const deletedAtQuerySchema = z.preprocess((val) => {
  const v = Array.isArray(val) ? val[0] : val;
  if (v === undefined || v === null || v === "") return undefined;

  if (typeof v === "string") {
    const lower = v.toLowerCase();
    if (lower === "true" || lower === "1") return true;
    if (lower === "false" || lower === "0") return false;
  }

  // 其他情况交给 date coercion（支持 Date 或可被 new Date(...) 解析的字符串）
  return v;
}, z.coerce.date().optional());

// 定义 getVendors 查询参数的 Schema
export const vendorQuerySchema = z.object({
  name: z.string().optional(),
  deletedAt: z.union([deletedAtQuerySchema, z.boolean().optional()])
}).merge(paginationSchema);

// 从 Schema 推断 TypeScript 类型
export type VendorQuery = z.infer<typeof vendorQuerySchema>;


export const vendorBatchDeleteSchema = z.object({
    id: z.array(z.number())
  })

export type VendorBatchDelete = z.infer<typeof vendorBatchDeleteSchema>;