import {
  CreateMultipleStockOut,
  stockOutQuerySchema,
  StockOutQuery,
  MultipleStockOutBody,
} from "../validators/stockOutValidator";
import { sum2, compareArrayMinLoop } from "../utils/algo";
import { SuccessResponse, ErrorResponse, errorCode } from "../models/Response";
import prisma from "../utils/prisma";
import {
  Pagination,
  UpdateId,
  CompletedAt,
  IdArray,
} from "../validators/commonValidator";
import { getPaginationValues, getWhereValues } from "../utils/db";
import { CommonStockLineComparable } from "./stockInController";
import { generateStockOperationSql } from "../sqlMap/stockOperation";
import dayjs from "dayjs";
import { StockOperationListRow } from "./stockInController";
import { generateServiceCode } from "../utils/common";
import { logger } from "../utils/logger";
import { BatchDeleteStockInQuery } from "../validators/stockInValidator";
import type { AuthContext } from "./userController";
import {
  auditCreate,
  auditSoftDelete,
  auditUpdate,
  auditUpdateConnect,
} from "../utils/auditUser";

const { PUBLIC_BASE_URL } = process.env;

type StockOutLineComparable = CommonStockLineComparable & {
  stockOutId?: number;
  price: number;
};

type StockOutInfo = {
  count: number;
  price: number;
};

export type StockOutListRow = StockOperationListRow & {
  totalPrice: number;
  productId: number;
  productName: string;
  cost: number;
  count: number;
  platformOrderNo?: string;
  platformId: number;
  serviceCode: string;
  docs?: string[];
  price: number;
};

export const getStockOuts = async ({ query }: { query: StockOutQuery }) => {
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
    isDeleted,
  } = query;
  const { skip, take } = getPaginationValues({ limit, page });

  const productNameStr =
    typeof productName === "string" ? productName.trim() : undefined;
  const vendorNameStr =
    typeof vendorName === "string" ? vendorName.trim() : undefined;

  const hasVendorFilter = Boolean(vendorNameStr && vendorNameStr.length > 0);

  const whereClauses: string[] = ["1=1"];
  const params: unknown[] = [];

  if (productNameStr) {
    whereClauses.push("p.name LIKE ?");
    params.push(`%${productNameStr}%`);
  }

  if (deletedStart || deletedEnd) {
    if (deletedStart) {
      whereClauses.push("s.deletedAt >= ?");
      params.push(dayjs(deletedStart).format("YYYY-MM-DD HH:mm:ss"));
    }
    if (deletedEnd) {
      whereClauses.push("s.deletedAt <= ?");
      params.push(dayjs(deletedEnd).format("YYYY-MM-DD HH:mm:ss"));
    }
  } else {
    if (isDeleted === "1") {
      whereClauses.push("s.deletedAt IS NOT NULL");
    } else {
      whereClauses.push("s.deletedAt IS NULL");
    }
  }
  if (completedStart) {
    whereClauses.push("s.completedAt >= ?");
    params.push(dayjs(completedStart).format("YYYY-MM-DD HH:mm:ss"));
  }
  if (completedEnd) {
    whereClauses.push("s.completedAt <= ?");
    params.push(dayjs(completedEnd).format("YYYY-MM-DD HH:mm:ss"));
  }

  if (hasVendorFilter) {
    whereClauses.push("v.name LIKE ?");
    params.push(`%${vendorNameStr}%`);
  }

  const vendorJoinSql = hasVendorFilter
    ? " LEFT JOIN Vendor v ON v.id = p.vendorId "
    : "";
  const whereSql = "WHERE " + whereClauses.join(" AND ");

  const joinFrom =
    `FROM StockOut s ` +
    `LEFT JOIN ProductJoinStockOut pjs ON pjs.stockOutId = s.id ` +
    `LEFT JOIN Product p ON p.id = pjs.productId` +
    vendorJoinSql;

  const countSql = `SELECT COUNT(DISTINCT s.id) as cnt ${joinFrom} ${whereSql}`;

  const countRows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    countSql,
    ...params,
  );

  const total = Number(countRows[0]?.cnt ?? 0);

  let list: Array<
    StockOperationListRow & {
      totalPrice: number;
      platformOrderNo?: string;
      platformId: number;
      submittedAt: Date;
      products: Array<{
        productId: number;
        productName: string;
        price: number;
        count: number;
      }>;
    }
  >;

  if (total === 0) {
    list = [];
  } else {
    // 先按「进货单」分页拿到当前页的 stockInId 列表
    const idSql =
      `SELECT s.id ${joinFrom} ${whereSql} GROUP BY s.id ORDER BY s.updatedAt DESC` +
      (pagination ? " LIMIT ? OFFSET ?" : "");
    const idParams = pagination ? [...params, take, skip] : params;
    const idRows = await prisma.$queryRawUnsafe<{ id: number }[]>(
      idSql,
      ...idParams,
    );
    const stockOutIds = idRows.map((r) => r.id);
    if (stockOutIds.length === 0) {
      list = [];
    } else {
      const placeholders = stockOutIds.map(() => "?").join(",");
      const rowsSql =
        `SELECT s.id, s.remark, s.docs, s.serviceCode, s.createdAt, s.updatedAt, s.deletedAt, s.totalPrice, s.status, s.completedAt, pjs.productId, p.name as productName, pjs.price, pjs.count, s.platformOrderNo ` +
        `FROM StockOut s ` +
        `LEFT JOIN ProductJoinStockOut pjs ON pjs.stockOutId = s.id ` +
        `LEFT JOIN Product p ON p.id = pjs.productId ` +
        `WHERE s.id IN (${placeholders}) ORDER BY s.updatedAt DESC`;
      const rows = await prisma.$queryRawUnsafe<StockOutListRow[]>(
        rowsSql,
        ...stockOutIds,
      );

      // 按进货单 id 聚合成「一单多商品」
      const byId = new Map<
        number,
        StockOperationListRow & {
          totalPrice: number;
          docs?: string[];
          platformOrderNo?: string;
          platformId: number;
          submittedAt: Date;
          products: Array<{
            productId: number;
            productName: string;
            price: number;
            count: number;
          }>;
        }
      >();
      for (const row of rows) {
        const existing = byId.get(row.id);
        if (!existing) {
          byId.set(row.id, {
            id: row.id,
            remark: row.remark,
            submittedAt: row.submittedAt,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            deletedAt: row.deletedAt,
            status: row.status,
            completedAt: row.completedAt,
            totalPrice: row.totalPrice,
            platformOrderNo: row.platformOrderNo,
            platformId: row.platformId,
            serviceCode: row.serviceCode,
            docs: row.docs
              ? row.docs.map((doc) => `${PUBLIC_BASE_URL}${doc}`)
              : undefined,
            products: [
              {
                productId: row.productId,
                productName: row.productName,
                price: row.price,
                count: row.count,
              },
            ],
          });
        } else {
          existing.products.push({
            productId: row.productId,
            productName: row.productName,
            price: row.price,
            count: row.count,
          });
        }
      }
      list = Array.from(byId.values()).sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      );
    }
  }

  // const { listSql, params, countSql } = generateStockOperationSql<StockInQuery>(
  //   "StockOut",
  //   "ProductJoinStockOut",
  //   query,
  // );
  // const listParams = pagination ? [...params, take, skip] : params;
  // type StockOutListRow = StockOperationListRow & {
  //   totalPrice: number;
  // };
  // const list = await prisma.$queryRawUnsafe<StockOutListRow[]>(
  //   listSql,
  //   ...listParams,
  // );

  // const countRows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
  //   countSql,
  //   ...params,
  // );
  // const total = Number(countRows[0]?.cnt ?? 0);

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
  user,
}: AuthContext & {
  body: CreateMultipleStockOut;
}) => {
  if (!user) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "未登录");
  }
  const uid = user.userId;
  const {
    productJoinStockOut,
    remark,
    platformId,
    platformOrderNo,
    clientId,
    docs,
    submittedAt,
  } = body;
  const totalPrice = sum2(productJoinStockOut, "price");
  const createdAt = body.submittedAt
    ? dayjs(body.submittedAt).toDate()
    : new Date();
  // const stockOutCode = await generateServiceCode("CH");
  const { serviceCode } = await generateServiceCode("CH", "stockOutCode");
  const results = await prisma.$transaction([
    // 创建出货记录
    prisma.stockOut.create({
      data: {
        clientId: clientId ?? undefined,
        serviceCode: serviceCode,
        createdAt,
        totalPrice,
        remark,
        docs,
        ...auditCreate(uid),
        platformId,
        platformOrderNo,
        productJoinStockOut: {
          create: productJoinStockOut.map((item) => {
            return {
              price: item.price,
              count: item.count,
              vendorId: item.vendorId,
              productId: item.productId,
              ...auditCreate(uid),
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
          ...auditUpdate(uid),
        },
      });
    }),
  ]);
  if (!results[0]) {
    return new ErrorResponse(
      errorCode.FAILED_TO_CREATE_STOCK_OUT,
      "出货记录批量新建失败",
    );
  }
  return new SuccessResponse(
    results[0],
    "出货记录批量新建成功, 出货单号: " + serviceCode,
  );
};

// 确认出货完成
export const confirmStockOutCompleted = async ({
  params,
  body,
  user,
}: AuthContext & {
  params: UpdateId;
  body: CompletedAt;
}) => {
  if (!user) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "未登录");
  }
  const uid = user.userId;
  const productsInRecord = await prisma.productJoinStockOut.findMany({
    where: {
      stockOutId: params.id,
    },
  });
  if (!productsInRecord || productsInRecord.length === 0) {
    return new ErrorResponse(
      errorCode.PRODUCT_NOT_FOUND,
      "出货单对应产品不存在",
    );
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
        ...auditUpdateConnect(uid),
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
          ...auditUpdate(uid),
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
  user,
}: AuthContext & {
  params: UpdateId;
  body: MultipleStockOutBody;
}) => {
  if (!user) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "未登录");
  }
  const uid = user.userId;
  const {
    productJoinStockOut,
    remark,
    createdAt,
    clientId,
    platformId,
    platformOrderNo,
    docs,
  } = body;
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
            ...auditUpdate(uid),
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
      vendorId: r.vendorId,
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
  const newClientValue =
    clientId === null
      ? { disconnect: true }
      : typeof clientId === "number"
        ? { connect: { id: clientId } }
        : undefined;
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
        ...(docs !== undefined && { docs }),
        // clientId 为 null 时须 disconnect，传 undefined 时 Prisma 不会清空该字段
        client: newClientValue,
        platform: platformId
          ? {
              connect: {
                id: platformId,
              },
            }
          : undefined,
        platformOrderNo,
        ...auditUpdateConnect(uid),
      },
    }),
    // 更新出货中间表记录
    // 更新出货中间表记录--对于新增的产品
    ...added.map((item) => {
      return prisma.productJoinStockOut.create({
        data: {
          price: item.price,
          count: item.count,
          productId: item.productId,
          stockOutId: params.id,
          vendorId: item.vendorId,
          ...auditCreate(uid),
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
          ...auditUpdateConnect(uid),
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
          ...auditUpdate(uid),
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
          ...auditUpdate(uid),
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
          ...auditUpdate(uid),
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
  if (result) {
    const baseUrl = PUBLIC_BASE_URL ?? "";
    if (Array.isArray(result.docs)) {
      result.docs = result.docs
        .filter((d): d is string => typeof d === "string")
        .map((doc) => `${baseUrl}${doc}`);
    }
  }
  return new SuccessResponse(result, "出货单更新成功");
};

async function getValidIdsAndPendingStockOut(
  ids: number[],
  isDeleted: boolean = false,
) {
  const pendingStockOuts = await prisma.stockOut.findMany({
    where: {
      id: {
        in: ids,
      },
      status: "PENDING",
      deletedAt: isDeleted
        ? {
            not: null,
          }
        : null,
    },
    select: {
      id: true,
    },
  });

  const validIds = pendingStockOuts.map((s) => s.id);

  if (validIds.length === 0) {
    return { validIds: [], pendingCount: {} };
  }

  // 查出所有关联的中间表记录，用于统计每个商品需要扣减的 stockInPending 数量
  const joinRows = await prisma.productJoinStockOut.findMany({
    where: {
      stockOutId: {
        in: validIds,
      },
      deletedAt: isDeleted
        ? {
            not: null,
          }
        : null,
    },
    select: {
      productId: true,
      count: true,
    },
  });

  const pendingCount: Record<number, number> = {};
  joinRows.forEach((row) => {
    pendingCount[row.productId] =
      (pendingCount[row.productId] ?? 0) + row.count;
  });

  return { validIds, pendingCount };
}

// 批量删除出货单
export const batchDeleteStockOut = async ({
  query,
  user,
}: AuthContext & {
  query: BatchDeleteStockInQuery;
}) => {
  if (!user) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "未登录");
  }
  const uid = user.userId;
  const ids = query.id as number[];

  if (!ids || ids.length === 0) {
    return new SuccessResponse(null, "没有需要删除的进货单");
  }

  // 只处理「未完成、未删除」的进货单，避免把已经完成的单子反向扣 pending
  const { validIds, pendingCount } = await getValidIdsAndPendingStockOut(
    ids,
    false,
  );

  if (validIds.length === 0) {
    return new SuccessResponse(null, "没有符合条件的出货单可删除");
  }
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
        ...auditSoftDelete(uid, now),
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
        ...auditSoftDelete(uid, now),
      },
    }),
    // 扣减对应商品的 stockInPending，并把商品数量加回
    ...Object.entries(pendingCount).map(([productId, totalCount]) =>
      prisma.product.update({
        where: {
          id: Number(productId),
        },
        data: {
          stockOutPending: {
            decrement: totalCount,
          },
          balance: {
            increment: totalCount,
          },
          ...auditUpdate(uid),
        },
      }),
    ),
  ]);

  return new SuccessResponse(txResults, "进货单批量删除成功");
};

// 恢复已删除的出货单
export const restoreDeletedStockOut = async ({
  body,
  user,
}: AuthContext & { body: IdArray }) => {
  if (!user) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "未登录");
  }
  const uid = user.userId;
  const ids = body.ids;
  if (!ids || ids.length === 0) {
    return new SuccessResponse(null, "没有需要恢复的出货单");
  }

  const { validIds, pendingCount } = await getValidIdsAndPendingStockOut(
    ids,
    true,
  );
  if (validIds.length === 0) {
    return new SuccessResponse(null, "没有符合条件的出货单可恢复");
  }
  const txResults = await prisma.$transaction([
    // 恢复出货单
    prisma.stockOut.updateMany({
      where: {
        id: {
          in: validIds,
        },
      },
      data: {
        deletedAt: null,
        ...auditUpdate(uid),
      },
    }),
    // 恢复中间表记录
    prisma.productJoinStockOut.updateMany({
      where: {
        stockOutId: {
          in: validIds,
        },
      },
      data: {
        deletedAt: null,
        ...auditUpdate(uid),
      },
    }),
    // 恢复对应商品的 stockOutPending，并把商品数量减去
    ...Object.entries(pendingCount).map(([productId, totalCount]) =>
      prisma.product.update({
        where: {
          id: Number(productId),
        },
        data: {
          stockOutPending: {
            increment: totalCount,
          },
          balance: {
            decrement: totalCount,
          },
          ...auditUpdate(uid),
        },
      }),
    ),
  ]);

  return new SuccessResponse(txResults, "出货单恢复成功");
};
