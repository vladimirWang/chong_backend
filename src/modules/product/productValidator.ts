import { z } from "zod";

// GET /product 列表 Query（pagination 用 "1"/"0" 字符串，与 repo_backend 一致）
export const productQuerySchema = z.object({
  limit: z.coerce.number().optional(),
  page: z.coerce.number().optional(),
  productName: z.string().optional(),
  pagination: z.xor([z.literal("1"), z.literal("0")]).optional(),
});
export type ProductQuery = z.infer<typeof productQuerySchema>;

// POST /product 创建入参
export const createProductBodySchema = z.object({
  name: z.string().min(2),
  remark: z.string().max(255).optional(),
  vendorId: z.coerce.number(),
  salePrice: z.number().optional(),
  img: z.string().optional(),
  desc: z.string().optional(),
});
export type CreateProductBody = z.infer<typeof createProductBodySchema>;

// PATCH /product/:id 更新入参
export const updateProductBodySchema = z.object({
  salePrice: z.number().optional(),
  name: z.string().optional(),
  remark: z.string().optional(),
  img: z.string().optional(),
  desc: z.string().optional(),
});
export type UpdateProductBody = z.infer<typeof updateProductBodySchema>;

// GET /product/getProductsByAmount 入参
export const productAmountQuerySchema = z.object({
  amount: z.coerce.number(),
  moreThan: z.coerce.boolean(),
  desc: z.coerce.boolean().optional(),
});
export type ProductAmountQuery = z.infer<typeof productAmountQuerySchema>;
