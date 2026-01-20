import prisma from "../utils/prisma";
import { SuccessResponse } from "../models/Response";
import {
  SingleStockInBody,
  MultipleStockInBody,
  StockInParams,
} from "../validators/stockInValidator";
import { luhn } from "../utils/algo";

// 获取进货记录列表
export const getStockIns = async () => {
  const result = await prisma.stockIn.findMany();
  const total = await prisma.stockIn.count();
  return JSON.stringify(
    new SuccessResponse({ list: result, total }, "进货记录列表获取成功")
  );
};

// 单个产品进货
export const createSingleStockIn = async ({
  body,
}: {
  body: SingleStockInBody;
}) => {
  const { productId, cost, count, remark } = body;
  const res = await prisma.stockIn.create({
    data: {
      remark,
      totalCost: cost * count,
      productJoinStockIn: {
        create: [
          {
            cost,
            count,
            product: {
              connect: {
                id: productId,
              },
            },
          },
        ],
      },
    },
  });
  return JSON.stringify(new SuccessResponse(null, "进货记录新建成功"));
};

// 批量产品进货
export const createMultipleStockIn = async ({
  body,
}: {
  body: MultipleStockInBody;
}) => {
  const totalCost = body.joinData.reduce((a, c) => {
    return a + c.cost * c.count;
  }, 0);

  // 查询所有产品信息（包括 vendorId）
  const productIds = body.joinData.map((item) => item.productId);
  const uniqueProductIds = [...new Set(productIds)];
  const products = await prisma.product.findMany({
    where: {
      id: {
        in: uniqueProductIds,
      },
    },
    select: {
      id: true,
      vendorId: true,
    },
  });

  // 创建产品 id 到产品信息的映射
  const productMap = new Map<number, { id: number; vendorId: number }>(
    products.map((p: { id: number; vendorId: number }) => [p.id, p])
  );

  const results = await prisma.$transaction([
    // 创建进库记录
    prisma.stockIn.create({
      data: {
        remark: body.remark,
        totalCost,
        productJoinStockIn: {
          create: body.joinData.map((item) => {
            return {
              cost: item.cost,
              count: item.count,
              product: {
                connect: {
                  id: item.productId,
                },
              },
            };
          }),
        },
      },
    }),
    // 修改库存并生成产品编码
    ...body.joinData.map((item) => {
      const product = productMap.get(item.productId);
      // 如果产品存在且有 vendorId，生成产品编码
      const updateData: {
        balance: { increment: number };
        productCode?: string;
        latestCost?: number;
      } = {
        balance: {
          increment: item.count,
        },
        latestCost: item.cost,
      };

      // TODO 正确处理判空
      const productCode = luhn(product!);
      updateData.productCode = productCode;

      return prisma.product.update({
        data: updateData,
        where: {
          id: item.productId,
        },
      });
    }),
  ]);
  return JSON.stringify(
    new SuccessResponse(results, "进货记录批量新建成功")
  );
};

// 根据ID获取进货记录
export const getStockInById = async ({
  params,
}: {
  params: StockInParams;
}) => {
  const { id } = params;
  const result = await prisma.stockIn.findUnique({
    where: {
      id,
    },
    select: {
      remark: true,
      productJoinStockIn: true,
    },
  });
  return JSON.stringify(new SuccessResponse(result, "进货记录查询成功"));
};
