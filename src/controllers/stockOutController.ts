import { CreateMultipleStockOut } from "../validators/stockOutValidator";
import { sum2, compareArrayMinLoop } from "../utils/algo";
import { SuccessResponse, ErrorResponse } from "../models/Response";
import prisma from "../utils/prisma";
import {
  Pagination,
  UpdateId,
  CompletedAt,
} from "../validators/commonValidator";
import { getPaginationValues, getWhereValues } from "../utils/db";
import { CommonStockLineComparable } from "./stockInController";
import { generateStockOperationSql } from "../sqlMap/stockOperation";
import dayjs from "dayjs";

type StockOutLineComparable = CommonStockLineComparable & {
  stockOutId?: number;
  price: number;
};

type StockOutInfo = {
  count: number;
  price: number;
};

export const getStockOuts = async ({ query }: { query: Pagination }) => {
  const {
    pagination = true,
    limit = 10,
    page = 1,
    deletedStart,
    deletedEnd,
    productName,
    vendorName,
    completedStart,
    completedEnd,
  } = query;
  const { skip, take } = getPaginationValues({ limit, page });

  const { listSql, params, countSql } = generateStockOperationSql<StockInQuery>(
    "StockOut",
    "ProductJoinStockOut",
    query,
  );
  const listParams = pagination ? [...params, take, skip] : params;
  type StockOutListRow = StockOperationListRow & {
    totalPrice: number;
  };
  const list = await prisma.$queryRawUnsafe<StockOutListRow[]>(
    listSql,
    ...listParams,
  );

  const countRows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    countSql,
    ...params,
  );
  const total = Number(countRows[0]?.cnt ?? 0);

  return new SuccessResponse(
    {
      list,
      total,
    },
    "出货记录列表获取成功",
  );
};

// 新建出货
export const createMultipleStockOut = async ({
  body,
}: {
  body: CreateMultipleStockOut;
}) => {
  const { productJoinStockOut, remark, platformId, platformOrderNo } = body;
  const totalPrice = sum2(productJoinStockOut, "price");
  const createdAt = body.createdAt
    ? dayjs(body.createdAt).toDate()
    : new Date();
  const results = await prisma.$transaction([
    // 创建出货记录
    prisma.stockOut.create({
      data: {
        createdAt,
        totalPrice,
        remark,
        platform: {
          connect: {
            id: platformId,
          },
        },
        platformOrderNo,
        productJoinStockOut: {
          create: productJoinStockOut.map((item) => {
            return {
              price: item.price,
              count: item.count,
              vendor: {
                connect: {
                  id: item.vendorId,
                },
              },
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
  if (!results[0]) {
    return new ErrorResponse(null, "出货记录批量新建失败");
  }
  return new SuccessResponse(results[0], "出货记录批量新建成功");
};

// 确认出货完成
export const confirmStockOutCompleted = async ({
  params,
  status,
  body,
}: {
  params: UpdateId;
  body: CompletedAt;
}) => {
  const productsInRecord = await prisma.productJoinStockOut.findMany({
    where: {
      stockOutId: params.id,
    },
  });
  if (!productsInRecord || productsInRecord.length === 0) {
    return new ErrorResponse(null, "出货单对应产品不存在");
  }

  const { completedAt = new Date() } = body || {};
  await prisma.$transaction([
    prisma.stockOut.update({
      where: {
        id: params.id,
      },
      data: {
        status: "COMPLETED",
        completedAt,
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
  return new SuccessResponse(null, "出货确认成功");
};

// 通过id更新出货
export const updateStockOut = async ({
  params,
  body,
}: {
  params: UpdateId;
  body: MultipleStockOutBody;
}) => {
  const { productJoinStockOut, remark, createdAt } = body;
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
    return new SuccessResponse(null, "出货单已删除（无产品数据）");
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
      vendorId: r.vendorId,
    }),
  );
  const { added, modified, deleted, unchanged } =
    compareArrayMinLoop<StockOutLineComparable>(
      existedComparable,
      newComparable,
      "productId",
      ["id", "stockOutId"],
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
  const result = await prisma.$transaction([
    // 更新出货中间表
    prisma.stockOut.update({
      where: {
        id: params.id,
      },
      data: {
        remark,
        createdAt,
        totalPrice,
      },
    }),
    // 更新出货中间表记录
    // 更新出货中间表记录--对于新增的产品
    ...added.map((item) => {
      return prisma.productJoinStockOut.create({
        data: {
          price: item.price,
          count: item.count,
          product: {
            connect: {
              id: item.productId,
            },
          },
          stockOut: {
            connect: {
              id: params.id,
            },
          },
          vendor: {
            connect: {
              id: item.vendorId,
            },
          },
        },
      });
    }),
    // 更新出货中间表记录--对于修改的产品
    ...modified.map((item) => {
      return prisma.productJoinStockOut.update({
        where: {
          stockOutId_productId: {
            stockOutId: params.id,
            productId: item.productId,
          },
        },
        data: {
          price: item.price,
          count: item.count,
        },
      });
    }),
    // 删除出货中间表记录--对于删除的产品
    ...deleted.map((item) => {
      return prisma.productJoinStockOut.delete({
        where: {
          stockOutId_productId: {
            stockOutId: params.id,
            productId: item.productId,
          },
        },
      });
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
  return new SuccessResponse(null, "出货单更新成功");
};

export const getStockOutDetailById = async ({
  params,
}: {
  params: UpdateId;
}) => {
  const result = await prisma.stockOut.findUnique({
    where: {
      id: params.id,
    },
    include: {
      productJoinStockOut: true,
    },
  });
  return new SuccessResponse(result, "出货单更新成功");
};

export const batchDeleteStockOut = async ({
  query,
}: {
  query: BatchDeleteStockInQuery;
}) => {
  const ids = query.id;

  if (!ids || ids.length === 0) {
    return new SuccessResponse(null, "没有需要删除的进货单");
  }

  // 只处理「未完成、未删除」的进货单，避免把已经完成的单子反向扣 pending
  const pendingStockOuts = await prisma.stockOut.findMany({
    where: {
      id: {
        in: ids,
      },
      status: "PENDING",
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  const validIds = pendingStockOuts.map((s) => s.id);

  if (validIds.length === 0) {
    return new SuccessResponse(null, "没有符合条件的出货单可删除");
  }

  // 查出所有关联的中间表记录，用于统计每个商品需要扣减的 stockInPending 数量
  const joinRows = await prisma.productJoinStockOut.findMany({
    where: {
      stockOutId: {
        in: validIds,
      },
      deletedAt: null,
    },
    select: {
      productId: true,
      count: true,
    },
  });

  const pendingDeltaByProduct: Record<number, number> = {};
  joinRows.forEach((row) => {
    pendingDeltaByProduct[row.productId] =
      (pendingDeltaByProduct[row.productId] ?? 0) + row.count;
  });

  const now = new Date();

  const txResults = await prisma.$transaction([
    // 软删除进货单
    prisma.stockOut.updateMany({
      where: {
        id: {
          in: validIds,
        },
      },
      data: {
        deletedAt: now,
      },
    }),
    // 软删除中间表记录
    prisma.productJoinStockOut.updateMany({
      where: {
        stockOutId: {
          in: validIds,
        },
        deletedAt: null,
      },
      data: {
        deletedAt: now,
      },
    }),
    // 扣减对应商品的 stockInPending
    ...Object.entries(pendingDeltaByProduct).map(([productId, totalCount]) =>
      prisma.product.update({
        where: {
          id: Number(productId),
        },
        data: {
          stockOutPending: {
            decrement: totalCount,
          },
        },
      }),
    ),
  ]);

  return new SuccessResponse(txResults, "进货单批量删除成功");
};
