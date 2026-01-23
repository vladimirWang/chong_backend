import { z, ZodError } from "zod";
import prisma from "../utils/prisma";

// 单个进货 Body Schema
export const singleStockInBodySchema = z.object({
  count: z.number(),
  cost: z.number(),
  productId: z.number(),
  remark: z.string().optional(),
});

export type SingleStockInBody = z.infer<typeof singleStockInBodySchema>;

// 批量进货 Body Schema
export const multipleStockInBodySchema = z.object({
  // remark: z.string().optional(),
  productJoinStockIn: z.array(
    z.object({
      count: z.number(),
      cost: z.number(),
      productId: z.number(),
    }),
  ),
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
