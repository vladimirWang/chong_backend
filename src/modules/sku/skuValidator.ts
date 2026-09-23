import { z } from "zod";

// POST /sku/category 创建 SKU 分类入参
export const createSkuCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(20),
});
export type CreateSkuCategoryBody = z.infer<typeof createSkuCategoryBodySchema>;

// POST /sku 创建 SKU 入参
export const createSkuBodySchema = z.object({
  name: z.string().trim().min(1).max(20),
  skuCategoryId: z.coerce.number().int().positive(),
});
export type CreateSkuBody = z.infer<typeof createSkuBodySchema>;

// GET /sku 列表 Query：categoryIds 为逗号分隔的 id（如 "1,2"），skuName 模糊查询
export const skuListQuerySchema = z.object({
  categoryIds: z.string().optional(),
  skuName: z.string().optional(),
});
export type SkuListQuery = z.infer<typeof skuListQuerySchema>;
