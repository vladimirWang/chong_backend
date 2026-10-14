import { z } from "zod";

// GET /product 列表 Query（pagination 用 "1"/"0" 字符串，与 repo_backend 一致）
export const productQuerySchema = z.object({
  limit: z.coerce.number().optional(),
  page: z.coerce.number().optional(),
  productName: z.string().optional(),
  pagination: z.xor([z.literal("1"), z.literal("0")]).optional(),
});
export type ProductQuery = z.infer<typeof productQuerySchema>;

// 库存预警阈值字段（可空：null/undefined 表示未设置，前端清空即 null）
const stockThresholdFields = {
  minStock: z.number().int().min(0).nullable().optional(),
  maxStock: z.number().int().min(0).nullable().optional(),
};

// 同时填写时须满足 最低 <= 最高
const ensureStockThresholdOrder = (d: {
  minStock?: number | null;
  maxStock?: number | null;
}) => d.minStock == null || d.maxStock == null || d.minStock <= d.maxStock;

const stockThresholdOrderOptions = {
  message: "最低库存不能大于最高库存",
  path: ["minStock"] as (string | number)[],
};

// POST /product 创建入参
export const createProductBodySchema = z
  .object({
    name: z.string().min(2),
    remark: z.string().max(255).optional(),
    vendorId: z.coerce.number(),
    salePrice: z.number().optional(),
    img: z.string().optional(),
    desc: z.string().optional(),
    attrIds: z.array(z.coerce.number()).optional(),
    ...stockThresholdFields,
  })
  .refine(ensureStockThresholdOrder, stockThresholdOrderOptions);
export type CreateProductBody = z.infer<typeof createProductBodySchema>;

// PATCH /product/:id 更新入参
export const updateProductBodySchema = z
  .object({
    salePrice: z.number().optional(),
    name: z.string().optional(),
    remark: z.string().optional(),
    img: z.string().optional(),
    desc: z.string().optional(),
    attrIds: z.array(z.coerce.number()).optional(),
    ...stockThresholdFields,
  })
  .refine(ensureStockThresholdOrder, stockThresholdOrderOptions);
export type UpdateProductBody = z.infer<typeof updateProductBodySchema>;

// GET /product/getProductsByAmount 入参
export const productAmountQuerySchema = z.object({
  amount: z.coerce.number(),
  moreThan: z.coerce.boolean(),
  desc: z.coerce.boolean().optional(),
});
export type ProductAmountQuery = z.infer<typeof productAmountQuerySchema>;
