import { z } from "zod";

// POST /attr/category 创建属性分类入参
export const createAttrCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(20),
});
export type CreateAttrCategoryBody = z.infer<typeof createAttrCategoryBodySchema>;

// POST /attr 创建属性入参
export const createAttrBodySchema = z.object({
  name: z.string().trim().min(1).max(20),
  attrCategoryId: z.coerce.number().int().positive(),
});
export type CreateAttrBody = z.infer<typeof createAttrBodySchema>;

// GET /attr 列表 Query：categoryIds 为逗号分隔的 id（如 "1,2"），attrName 模糊查询
export const attrListQuerySchema = z.object({
  categoryIds: z.string().optional(),
  attrName: z.string().optional(),
});
export type AttrListQuery = z.infer<typeof attrListQuerySchema>;
