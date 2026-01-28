import prisma from "../utils/prisma";
import { SuccessResponse } from "../models/Response";
import { Prisma } from "@prisma/client";
import {
  SingleStockInBody,
  MultipleStockInBody,
  StockInParams,
} from "../validators/stockInValidator";
import { compareArrayMinLoop, luhn } from "../utils/algo";
import _ from "lodash";
import {
  updateIdSchema,
  Pagination,
  DeletedStartEnd,
} from "../validators/commonValidator";
import dayjs from "dayjs";
import { getPaginationValues } from "../utils/db";

// 获取进货记录列表
export const getStockIns = async ({
  query,
}: {
  query: Pagination & DeletedStartEnd;
}) => {
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
  type StockInListRow = {
    id: number;
    remark: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    totalCost: number;
    status: string;
    completedAt: Date | null;
  };

  // 校验后已是 string | undefined，只做 trim
  const productNameStr =
    productName != null && typeof productName === "string"
      ? productName.trim()
      : undefined;
  const vendorNameStr =
    vendorName != null && typeof vendorName === "string"
      ? vendorName.trim()
      : undefined;

  const hasVendorFilter = Boolean(vendorNameStr && vendorNameStr.length > 0);

  // 用片段 + 参数数组拼 SQL，避免 Prisma.sql 嵌套导致参数顺序错乱（MariaDB）
  const whereClauses: string[] = ["1=1"];
  const params: unknown[] = [];

  if (productNameStr) {
    whereClauses.push("p.name LIKE ?");
    params.push(`%${productNameStr}%`);
  }

  // raw 查询不经过 $extends，需手动加「未删除」条件，与 findMany 行为一致
  const deletedStartDate = deletedStart ? dayjs(deletedStart).toDate() : null;
  const deletedEndDate = deletedEnd ? dayjs(deletedEnd).toDate() : null;
  if (deletedStartDate || deletedEndDate) {
    if (deletedStartDate) {
      whereClauses.push("s.deletedAt >= ?");
      params.push(deletedStartDate);
    }
    if (deletedEndDate) {
      whereClauses.push("s.deletedAt <= ?");
      params.push(deletedEndDate);
    }
  } else {
    whereClauses.push("s.deletedAt IS NULL");
  }

  if (completedStart) {
    whereClauses.push("s.completedAt >= ?");
    params.push(dayjs(completedStart).toDate());
  }
  if (completedEnd) {
    whereClauses.push("s.completedAt <= ?");
    params.push(dayjs(completedEnd).toDate());
  }
  if (deletedStart) {
    whereClauses.push("s.deletedStart >= ?");
    params.push(dayjs(deletedStart).toDate());
  }
  if (deletedEnd) {
    whereClauses.push("s.deletedEnd <= ?");
    params.push(dayjs(deletedEnd).toDate());
  }

  if (hasVendorFilter) {
    whereClauses.push("v.name LIKE ?");
    params.push(`%${vendorNameStr}%`);
  }

  const vendorJoinSql = hasVendorFilter
    ? " INNER JOIN Vendor v ON v.id = p.vendorId "
    : "";
  const whereSql = "WHERE " + whereClauses.join(" AND ");

  const listSql =
    `SELECT DISTINCT s.id, s.remark, s.createdAt, s.updatedAt, s.deletedAt, s.totalCost, s.status, s.completedAt ` +
    `FROM StockIn s ` +
    `INNER JOIN ProductJoinStockIn pjs ON pjs.stockInId = s.id ` +
    `INNER JOIN Product p ON p.id = pjs.productId` +
    vendorJoinSql +
    ` ${whereSql} ORDER BY s.updatedAt DESC` +
    (pagination ? " LIMIT ? OFFSET ?" : "");
  const listParams = pagination ? [...params, take, skip] : params;

  const list = await prisma.$queryRawUnsafe<StockInListRow[]>(
    listSql,
    ...listParams,
  );

  const countSql =
    `SELECT COUNT(DISTINCT s.id) as cnt FROM StockIn s ` +
    `INNER JOIN ProductJoinStockIn pjs ON pjs.stockInId = s.id ` +
    `INNER JOIN Product p ON p.id = pjs.productId` +
    vendorJoinSql +
    ` ${whereSql}`;
  const countRows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    countSql,
    ...params,
  );
  const total = Number(countRows[0]?.cnt ?? 0);

  return JSON.stringify(
    new SuccessResponse(
      {
        list,
        total,
      },
      "进货记录列表获取成功",
    ),
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
  // 合并相同 productId 和 cost 的数据，count 相加
  // [{productId: 1, cost: 10, count: 10}, {productId: 1, cost: 10, count: 30}]
  // => [{productId: 1, cost: 10, count: 40}]
  const mergedMap = new Map<
    string,
    { productId: number; cost: number; count: number; createdAt: string }
  >();
  const productIds = [];
  body.productJoinStockIn.forEach((item) => {
    productIds.push(item.productId);
    const key = `${item.productId}-${item.cost}`;
    const existing = mergedMap.get(key);
    if (existing) {
      existing.count += item.count;
    } else {
      mergedMap.set(key, {
        productId: item.productId,
        cost: item.cost,
        count: item.count,
        createdAt: item.createdAt,
      });
    }
  });

  // 转换为数组
  const mergedProductJoinStockIn = Array.from(mergedMap.values());

  const totalCost = mergedProductJoinStockIn.reduce((a, c) => {
    return a + c.cost * c.count;
  }, 0);

  // 查询所有产品信息（包括 vendorId）

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
    products.map((p: { id: number; vendorId: number }) => [p.id, p]),
  );

  const bodyCreatedAtStr = mergedProductJoinStockIn[0]?.createdAt;
  const createdAt = bodyCreatedAtStr
    ? dayjs(bodyCreatedAtStr).toDate()
    : new Date();
  const results = await prisma.$transaction([
    // 创建进库记录
    prisma.stockIn.create({
      data: {
        createdAt,
        // remark: body.remark,
        totalCost,
        productJoinStockIn: {
          create: mergedProductJoinStockIn.map((item) => {
            return {
              cost: item.cost,
              count: item.count,
              product: {
                connect: {
                  id: item.productId,
                },
              },
              vendor: {
                connect: {
                  id: productMap.get(item.productId)?.vendorId,
                },
              },
              historyCost: {
                create: {
                  value: item.cost,
                  productId: item.productId,
                },
              },
            };
          }),
        },
      },
    }),
    // 修改待进库数
    ...body.productJoinStockIn.map((item) => {
      return prisma.product.update({
        data: {
          stockInPending: {
            increment: item.count,
          },
        },
        where: {
          id: item.productId,
        },
      });
    }),
  ]);
  return JSON.stringify(new SuccessResponse(results, "进货记录批量新建成功"));
};

// 根据ID获取进货记录
export const getStockInById = async ({ params }: { params: StockInParams }) => {
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
interface StockInInfo {
  count: number;
  cost: number;
}

export interface CommonStockLineComparable {
  id?: number;
  productId: number;
  count: number;
}
type StockInLineComparable = CommonStockLineComparable & {
  stockInId?: number;
  cost: number;
};
export const updateStockIn = async ({
  params,
  body,
}: {
  params: updateIdSchema;
  body: MultipleStockInBody;
}) => {
  // 查询已有数据
  const existedRecord = await prisma.productJoinStockIn.findMany({
    where: {
      stockInId: params.id,
    },
  });
  // return 'hhehh  '+params.id + '; length: ' +body.productJoinStockIn.length
  const { productJoinStockIn } = body;
  const totalCost = productJoinStockIn.reduce(
    (a, c) => a + c.cost * c.count,
    0,
  );
  const existedComparable: StockInLineComparable[] = existedRecord.map((r) => ({
    id: r.id,
    stockInId: r.stockInId,
    productId: r.productId,
    cost: r.cost,
    count: r.count,
  }));
  const newComparable: StockInLineComparable[] = productJoinStockIn.map(
    (r) => ({
      productId: r.productId,
      cost: r.cost,
      count: r.count,
    }),
  );
  const { added, modified, deleted, unchanged } =
    compareArrayMinLoop<StockInLineComparable>(
      existedComparable,
      newComparable,
      "productId",
      ["id", "stockInId"],
    );
  console.log("modified: ", modified);

  const existedInfoMap: Record<number, StockInInfo> = existedRecord.reduce(
    (a: Record<number, StockInInfo>, c) => {
      a[c.productId] = {
        count: c.count,
        cost: c.cost,
      };
      return a;
    },
    {},
  );
  const deletedJoinIds = deleted
    .map((item) => item.id)
    .filter((id): id is number => typeof id === "number");

  await prisma.$transaction([
    // 删除被移除商品对应的历史成本（即使有级联，也做显式兜底）
    prisma.historyCost.deleteMany({
      where: {
        productJoinStockInId: {
          in: deletedJoinIds,
        },
      },
    }),
    // 更新进货记录
    prisma.stockIn.update({
      where: {
        id: params.id,
      },
      data: {
        totalCost,
        // 更新中间表
        productJoinStockIn: {
          // 新增原本没有的记录
          create: added.map((item) => {
            return {
              cost: item.cost,
              count: item.count,
              product: {
                connect: {
                  id: item.productId,
                },
              },
              historyCost: {
                create: {
                  value: item.cost,
                  productId: item.productId,
                },
              },
            };
          }),
          // 更新原本已有的数据
          update: modified.map((item) => {
            return {
              where: {
                stockInId_productId: {
                  stockInId: params.id,
                  productId: item.productId,
                },
              },
              data: {
                cost: item.cost,
                count: item.count,
                historyCost: {
                  upsert: {
                    create: {
                      value: item.cost,
                      productId: item.productId,
                    },
                    update: {
                      value: item.cost,
                      productId: item.productId,
                    },
                  },
                },
              },
            };
          }),
          deleteMany: deleted.map((item) => {
            return {
              // TODO 解决没有属性id的问题
              // id: item.id!
              stockInId: params.id,
              productId: item.productId,
            };
          }),
        },
      },
    }),
    // 更新产品待进库-对新增的商品
    // 不管新增还是编辑已有商品
    // TODO 删除进货中某个商品时，要把最新成本还原到前一次，多加一个表来实现
    ...added.map((item) => {
      return prisma.product.update({
        where: {
          id: item.productId,
        },
        data: {
          stockInPending: {
            increment: item.count,
          },
        },
      });
    }),
    // 更新产品库存-对修改的商品
    ...modified.map((item) => {
      console.log(
        "updated balance: ",
        item.count,
        existedInfoMap[item.productId].count,
      );
      return prisma.product.update({
        where: {
          id: item.productId,
        },
        data: {
          stockInPending: {
            increment: item.count - existedInfoMap[item.productId].count,
          },
          latestCost: item.cost,
        },
      });
    }),
    // 更新产品库存-对删除的商品
    ...deleted.map((item) => {
      return prisma.product.update({
        where: {
          id: item.productId,
        },
        data: {
          stockInPending: {
            increment: -1 * existedInfoMap[item.productId].count,
          },
          latestCost: item.cost,
        },
      });
    }),
  ]);
  return JSON.stringify(new SuccessResponse(null, "进货单更新成功"));
};

// 确认收货
export const confirmCompleted = async ({
  params,
  body,
}: {
  params: UpdateId;
  body: CompletedAt;
}) => {
  const relatedProducts = await prisma.productJoinStockIn.findMany({
    where: {
      stockInId: params.id,
    },
  });
  const relatedProductMap = relatedProducts.reduce(
    (a: Record<number, StockOutLineComparable>, c) => {
      a[c.productId] = c;
      return a;
    },
    {},
  );

  const { completedAt = new Date() } = body || {};
  const record = await prisma.$transaction([
    // 改进货单状态
    prisma.stockIn.update({
      where: {
        id: params.id,
      },
      data: {
        status: "COMPLETED",
        completedAt,
      },
    }),
    // 改产品表，把待进货加到库存数中
    ...relatedProducts.map((item) => {
      // // TODO 正确处理判空
      const productCode = luhn(item!);
      return prisma.product.update({
        where: {
          id: item.productId,
        },
        data: {
          productCode,
          balance: {
            increment: item.count,
          },
          stockInPending: {
            increment: -1 * item.count,
          },
          latestCost: item.cost,
        },
      });
    }),
  ]);
  return JSON.stringify(new SuccessResponse(record, "进货单确认成功"));
};

export const deleteStockIn = async ({
  params,
  // query,
}: {
  params: updateIdSchema;
  // query: DeletedStartEnd;
}) => {
  const { id } = params;
  const result = await prisma.stockIn.update({
    where: {
      id,
    },
    data: {
      deletedAt: new Date(),
    },
  });
  return JSON.stringify(new SuccessResponse(result, "进货单删除成功"));
};
