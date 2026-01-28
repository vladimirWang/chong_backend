import { z } from "zod";

// 获取产品列表 Query Schema
export const productQuerySchema = z.object({
  limit: z.coerce.number().optional(),
  page: z.coerce.number().optional(),
  productName: z.string().optional(),
});

export type ProductQuery = z.infer<typeof productQuerySchema>;

// 创建产品 Body Schema
export const createProductBodySchema = z.object({
  name: z.string().min(2),
  remark: z.string().max(255).optional(),
  vendorId: z.coerce.number(),
});

export type CreateProductBody = z.infer<typeof createProductBodySchema>;

// 更新产品 Body Schema
export const updateProductBodySchema = z.object({
  price: z.number().optional(),
  cost: z.number().optional(),
  name: z.string().optional(),
  remark: z.string().optional(),
  img: z.string().optional(),
});

export type UpdateProductBody = z.infer<typeof updateProductBodySchema>;

// 根据供应商ID获取产品参数 Schema
export const productByVendorParamsSchema = z.object({
  vendorId: z.coerce.number(),
});

export type ProductByVendorParams = z.infer<typeof productByVendorParamsSchema>;
