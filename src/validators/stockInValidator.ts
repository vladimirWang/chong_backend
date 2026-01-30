import { z, ZodError } from "zod";
import prisma from "../utils/prisma";
import { paginationSchema } from "./commonValidator";

// 单个进货 Body Schema
export const singleStockInBodySchema = z
  .object({
    count: z.number(),
    cost: z.number(),
    productId: z.number(),
    remark: z.string().optional(),
  })
  .merge(paginationSchema);

export type SingleStockInBody = z.infer<typeof singleStockInBodySchema>;

// 批量进货 Body Schema
export const multipleStockInBodySchema = z.object({
  // remark: z.string().optional(),
  productJoinStockIn: z.array(
    z.object({
      count: z.number(),
      cost: z.number(),
      productId: z.number(),
      vendorId: z.number(),
    }),
  ),
  createdAt: z.string().optional(),
  remark: z.string().max(190).optional(),
});

export type MultipleStockInBody = z.infer<typeof multipleStockInBodySchema>;

// 校验产品是否存在
export const mutilpleProductExistedValidator = async ({
  body,
}: {
  body: MultipleStockInBody;
}) => {
  // 验证所有产品是否存在
  const productIds = body.productJoinStockIn.map((item) => item.productId);
  const uniqueProductIds = [...new Set(productIds)];

  const existingProducts = await prisma.product.findMany({
    where: {
      id: {
        in: uniqueProductIds,
      },
    },
    select: {
      id: true,
    },
  });

  const existingProductIds = existingProducts.map((p: { id: number }) => p.id);
  const missingProductIds = uniqueProductIds.filter(
    (id) => !existingProductIds.includes(id),
  );

  if (missingProductIds.length > 0) {
    throw new ZodError([
      {
        code: "custom",
        path: ["productId"],
        message: `产品不存在: ${missingProductIds.join(", ")}`,
      },
    ]);
  }
};

export const stockInQuerySchema = z
  .object({
    productName: z.string().optional(),
    deletedStart: z.coerce.date().optional(),
    deletedEnd: z.coerce.date().optional(),
    vendorName: z.string().optional(),
    completedStart: z.coerce.date().optional(),
    completedEnd: z.coerce.date().optional(),
  })
  .merge(paginationSchema);

export type StockInQuery = z.infer<typeof stockInQuerySchema>;

// 根据id批量删除：数字数组直接通过，单个数字转为长度为1的数组
export const batchDeleteStockInQuerySchema = z
  .union([
    z.object({
      id: z.array(z.coerce.number()),
    }),
    z.object({
      id: z.coerce.number(),
    }),
  ])
  .transform((val) => (typeof val.id === "number" ? { id: [val.id] } : val));

export type BatchDeleteStockInQuery = z.infer<
  typeof batchDeleteStockInQuerySchema
>;
