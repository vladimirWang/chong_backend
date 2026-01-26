import { CreateMultipleStockOut } from "../validators/stockOutValidator";
import { sum2, compareArrayMinLoop } from "../utils/algo";
import { SuccessResponse, ErrorResponse } from "../models/Response";
import prisma from "../utils/prisma";
import { Pagination, UpdateId, CompletedAt } from "../validators/commonValidator";
import { getPaginationValues, getWhereValues } from "../utils/db";
import { CommonStockLineComparable } from "./stockInController";

type StockOutLineComparable = CommonStockLineComparable & {
  stockOutId?: number;
  price: number;
};

type StockOutInfo = {
  count: number;
  price: number;
};

export const getStockOuts = async ({ query }: { query: Pagination }) => {
  const { limit = 10, page = 1, pagination = true } = query;
  const { skip, take } = getPaginationValues({ limit, page });
  const result = await prisma.stockOut.findMany({
    skip,
    take,
  });
  const total = await prisma.stockOut.count();
  return JSON.stringify(
    new SuccessResponse({ list: result, total }, "出货记录列表获取成功"),
  );
};

// 新建出货
export const createMultipleStockOut = async ({
  body,
}: {
  body: CreateMultipleStockOut;
}) => {
  const { productJoinStockOut, remark } = body;
  const totalPrice = sum2(productJoinStockOut, "price");
  await prisma.$transaction([
    // 创建出货记录
    prisma.stockOut.create({
      data: {
        totalPrice,
        remark,
        productJoinStockOut: {
          create: productJoinStockOut.map((item) => {
            return {
              price: item.price,
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
    // 更新产品表库存数和出货中数量
    ...productJoinStockOut.map((item) => {
      return prisma.product.update({
        where: {
          id: item.productId,
        },
        data: {
          balance: {
            decrement: item.count,
          },
          stockOutPending: {
            increment: item.count,
          },
        },
      });
    }),
  ]);

  return JSON.stringify(new SuccessResponse(null, "出货创建成功"));
};

// 确认出货完成
export const confirmStockOutCompleted = async ({
  params,
  status,
  body
}: {
  params: UpdateId;
  body:  CompletedAt
}) => {
  const productsInRecord = await prisma.productJoinStockOut.findMany({
    where: {
      stockOutId: params.id,
    },
  });
  if (!productsInRecord || productsInRecord.length === 0) {
    return JSON.stringify(new ErrorResponse(null, "出货单对应产品不存在"));
  }
  const productMap = productsInRecord.reduce(
    (a: Record<number, StockOutLineComparable>, c) => {
      a[c.productId] = c;
      return a;
    },
    {},
  );
  const {completedAt = new Date()} = body || {}
  await prisma.$transaction([
    prisma.stockOut.update({
      where: {
        id: params.id,
      },
      data: {
        status: "COMPLETED",
        completedAt
      },
    }),
    ...productsInRecord.map((item) => {
      return prisma.product.update({
        where: {
          id: item.productId,
        },
        data: {
          stockOutPending: {
            decrement: item.count,
          },
          latestPrice: item.price,
        },
      });
    }),
  ]);
  return JSON.stringify(new SuccessResponse(null, "出货确认成功"));
};

// 通过id更新出货
export const updateStockOut = async ({
  params,
  body,
}: {
  params: UpdateId;
  body: MultipleStockOutBody;
}) => {
  const { productJoinStockOut } = body;
  // 查询已有数据
  const existedRecord = await prisma.productJoinStockOut.findMany({
    where: {
      stockOutId: params.id,
    },
  });
  // 如果更新后产品为空，则删除出货记录
  if (!productJoinStockOut || productJoinStockOut.length === 0) {
    await prisma.$transaction([
      // 恢复已有产品的库存
      ...existedRecord.map((item) => {
        return prisma.product.update({
          where: {
            id: item.productId,
          },
          data: {
            balance: {
              increment: item.count,
            },
            stockOutPending: {
              increment: -1 * item.count,
            },
          },
        });
      }),
      // 删除出货记录（级联删除会自动删除关联的productJoinStockOut）
      prisma.stockOut.delete({
        where: {
          id: params.id,
        },
      }),
    ]);
    return JSON.stringify(
      new SuccessResponse(null, "出货单已删除（无产品数据）"),
    );
  }
  const totalPrice = productJoinStockOut.reduce(
    (a, c) => a + c.price * c.count,
    0,
  );

  const existedComparable: StockOutLineComparable[] = existedRecord.map(
    (r) => ({
      id: r.id,
      stockOutId: r.stockOutId,
      productId: r.productId,
      price: r.price,
      count: r.count,
    }),
  );
  const newComparable: StockOutLineComparable[] = productJoinStockOut.map(
    (r) => ({
      productId: r.productId,
      price: r.price,
      count: r.count,
    }),
  );
  const { added, modified, deleted, unchanged } =
    compareArrayMinLoop<StockOutLineComparable>(
      existedComparable,
      newComparable,
      "productId",
      ["id", "stockInId"],
    );

  const existedInfoMap: Record<number, StockOutInfo> = existedRecord.reduce(
    (a: Record<number, StockOutInfo>, c) => {
      a[c.productId] = {
        count: c.count,
        price: c.price,
      };
      return a;
    },
    {},
  );
  console.log("existedInfoMap: ", JSON.stringify(existedInfoMap));
  const result = await prisma.$transaction([
    // 更新出货中间表
    prisma.stockOut.update({
      where: {
        id: params.id,
      },
      data: {
        totalPrice,
        productJoinStockOut: {
          create: added.map((item) => {
            return {
              price: item.price,
              count: item.count,
              product: {
                connect: {
                  id: item.productId,
                },
              },
            };
          }),
          update: modified.map((item) => {
            return {
              where: {
                stockOutId_productId: {
                  stockOutId: params.id,
                  productId: item.productId,
                },
              },
              data: {
                count: item.count,
                price: item.price,
              },
            };
          }),
          deleteMany: deleted.map((item) => {
            return {
              stockOutId: params.id,
              productId: item.productId,
            };
          }),
        },
      },
    }),
    // 更新产品表库存数和出货中数量--对于新增的产品
    ...added.map((item) => {
      return prisma.product.update({
        where: {
          id: item.productId,
        },
        data: {
          balance: {
            increment: -1 * item.count,
          },
          stockOutPending: {
            increment: item.count,
          },
        },
      });
    }),
    // 更新产品表库存数和出货中数量--对于修改的产品
    ...modified.map((item) => {
      const existedCount = existedInfoMap[item.productId].count ?? 0;
      // 新可用库存 = 把老的商品数量加回 - 本次的数量
      const balanceDelta = existedCount - item.count;
      return prisma.product.update({
        where: {
          id: item.productId,
        },
        data: {
          balance: {
            increment: balanceDelta,
          },
          stockOutPending: {
            increment: -1 * balanceDelta,
          },
        },
      });
    }),
    // 更新产品表库存数和出货中数量--对于删除的产品
    ...deleted.map((item) => {
      return prisma.product.update({
        where: {
          id: item.productId,
        },
        data: {
          balance: {
            increment: item.count,
          },
          stockOutPending: {
            increment: -1 * item.count,
          },
        },
      });
    }),
    // 如果更新后，产品为空，则删除出货记录
  ]);
  return JSON.stringify(new SuccessResponse(null, "出货单更新成功"));
};


export const getStockOutDetailById = async({params}: {params: UpdateId}) => {
  const result = await prisma.stockOut.findUnique({
    where: {
      id: params.id
    },
    select: {
      productJoinStockOut: true
    }
  })
  return JSON.stringify(new SuccessResponse(result, "出货单更新成功"));
}