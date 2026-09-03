import {
  CreateMultipleStockOut,
  stockOutQuerySchema,
  StockOutQuery,
  MultipleStockOutBody,
} from "../validators/stockOutValidator";
import { sum2, compareArrayMinLoop } from "../utils/algo";
import { SuccessResponse, ErrorResponse, errorCode } from "../models/Response";
import prisma, {TenantPrismaClient} from "../utils/prisma";
import type { Prisma } from "@prisma/client";
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
  auditCreateConnect
} from "../utils/auditUser";
import {AuthInject} from "../macro/auth.macro";

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

export const getStockOuts = async ({
  query,
  tenantPrisma,
}: {
  query: StockOutQuery;
  tenantPrisma: TenantPrismaClient;
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
    isDeleted,
  } = query;
  const { skip, take } = getPaginationValues({ limit, page });

  const productNameStr =
    typeof productName === "string" ? productName.trim() : undefined;
  const vendorNameStr =
    typeof vendorName === "string" ? vendorName.trim() : undefined;

  // —— 构建 where 条件 —— //
  // tenantPrisma 自动注入 tenantId；软删除扩展自动注入 deletedAt: null（除非显式覆盖）
  const where: Prisma.StockOutWhereInput = {};

  // 嵌套关系过滤
  if (productNameStr || vendorNameStr) {
    where.productJoinStockOut = {
      some: {
        product: {
          ...(productNameStr
            ? { name: { contains: productNameStr } }
            : {}),
          ...(vendorNameStr
            ? { vendor: { name: { contains: vendorNameStr } } }
            : {}),
        },
      },
    };
  }

  // deletedAt
  if (deletedStart || deletedEnd) {
    where.deletedAt = {
      ...(deletedStart ? { gte: dayjs(deletedStart).toDate() } : {}),
      ...(deletedEnd ? { lte: dayjs(deletedEnd).toDate() } : {}),
    };
  } else if (isDeleted === "1") {
    where.deletedAt = { not: null };
  }

  if (completedStart) {
    where.completedAt = {
      ...((where.completedAt as object) || {}),
      gte: dayjs(completedStart).toDate(),
    };
  }
  if (completedEnd) {
    where.completedAt = {
      ...((where.completedAt as object) || {}),
      lte: dayjs(completedEnd).toDate(),
    };
  }

  // —— 查询 —— //
  const [total, stockOuts] = await Promise.all([
    tenantPrisma.stockOut.count({ where }),
    tenantPrisma.stockOut.findMany({
      where,
      ...(pagination ? { skip, take } : {}),
      orderBy: { updatedAt: "desc" },
      include: {
        productJoinStockOut: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  // —— 映射输出：与原 raw SQL 返回结构一致 —— //
  const list = stockOuts.map((s) => ({
    id: s.id,
    remark: s.remark,
    createdAt: s.createdAt,
    submittedAt: s.createdAt,
    updatedAt: s.updatedAt,
    deletedAt: s.deletedAt,
    status: s.status,
    completedAt: s.completedAt,
    totalPrice: s.totalPrice,
    serviceCode: s.serviceCode,
    platformOrderNo: s.platformOrderNo,
    platformId: s.platformId,
    docs: s.docs
      ? (s.docs as string[]).map((doc) => `${PUBLIC_BASE_URL}${doc}`)
      : undefined,
    products: s.productJoinStockOut.map((pjs) => ({
      productId: pjs.productId,
      productName: pjs.product?.name ?? "",
      price: pjs.price,
      count: pjs.count,
    })),
  }));

  return new SuccessResponse(
    { list, total },
    "出货记录列表获取成功",
  );
};

// 新建出货
export const createMultipleStockOut = async ({
  body,
  user,
  tenantPrisma
}: AuthContext & AuthInject & {
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
  const results = await tenantPrisma.$transaction([
    // 创建出货记录
    tenantPrisma.stockOut.create({
      data: {
        tenant: { connect: { id: user.tenantId! } },
        client: clientId
          ? {
              connect: {
                id: clientId,
              },
            }
          : undefined,
        serviceCode: serviceCode,
        createdAt,
        totalPrice,
        remark,
        docs,
        ...auditCreateConnect(uid),
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
              tenant: { connect: { id: user.tenantId! } },
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
              ...auditCreateConnect(uid),
            };
          }),
        },
      },
    }),
    // 更新产品表库存数和出货中数量
    ...productJoinStockOut.map((item) => {
      return tenantPrisma.product.update({
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
          ...auditUpdateConnect(uid),
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
  tenantPrisma
}: AuthContext & AuthInject & {
  params: UpdateId;
  body: CompletedAt;
}) => {
  if (!user) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "未登录");
  }
  const uid = user.userId;
  const productsInRecord = await tenantPrisma.productJoinStockOut.findMany({
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
  await tenantPrisma.$transaction([
    tenantPrisma.stockOut.update({
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
      return tenantPrisma.product.update({
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
  tenantPrisma
}: AuthContext & AuthInject & {
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
  const existedRecord = await tenantPrisma.productJoinStockOut.findMany({
    where: {
      stockOutId: params.id,
    },
  });
  // 如果更新后产品为空，则删除出货记录
  if (!productJoinStockOut || productJoinStockOut.length === 0) {
    await tenantPrisma.$transaction([
      // 恢复已有产品的库存
      ...existedRecord.map((item) => {
        return tenantPrisma.product.update({
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
      tenantPrisma.stockOut.delete({
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
  const result = await tenantPrisma.$transaction([
    // 更新出货中间表
    tenantPrisma.stockOut.update({
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
      return tenantPrisma.productJoinStockOut.create({
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
      return tenantPrisma.productJoinStockOut.update({
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
      return tenantPrisma.productJoinStockOut.delete({
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
      return tenantPrisma.product.update({
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
      return tenantPrisma.product.update({
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
      return tenantPrisma.product.update({
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
  tenantPrisma
}: AuthContext & AuthInject & {
  params: UpdateId;
}) => {
  const result = await tenantPrisma.stockOut.findUnique({
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
  tenantPrisma: TenantPrismaClient
) {
  const pendingStockOuts = await tenantPrisma.stockOut.findMany({
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
  const joinRows = await tenantPrisma.productJoinStockOut.findMany({
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
  tenantPrisma
}: AuthContext & AuthInject & {
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
    tenantPrisma
  );

  if (validIds.length === 0) {
    return new SuccessResponse(null, "没有符合条件的出货单可删除");
  }
  const now = new Date();

  const txResults = await tenantPrisma.$transaction([
    // 软删除进货单
    tenantPrisma.stockOut.updateMany({
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
    tenantPrisma.productJoinStockOut.updateMany({
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
      tenantPrisma.product.update({
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
  tenantPrisma
}: AuthContext & AuthInject & { body: IdArray }) => {
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
    tenantPrisma
  );
  if (validIds.length === 0) {
    return new SuccessResponse(null, "没有符合条件的出货单可恢复");
  }
  const txResults = await tenantPrisma.$transaction([
    // 恢复出货单
    tenantPrisma.stockOut.updateMany({
      where: {
        id: {
          in: validIds,
        },
      },
      data: {
        deletedAt: null,
        ...auditUpdateConnect(uid),
      },
    }),
    // 恢复中间表记录
    tenantPrisma.productJoinStockOut.updateMany({
      where: {
        stockOutId: {
          in: validIds,
        },
      },
      data: {
        deletedAt: null,
        ...auditUpdateConnect(uid),
      },
    }),
    // 恢复对应商品的 stockOutPending，并把商品数量减去
    ...Object.entries(pendingCount).map(([productId, totalCount]) =>
      tenantPrisma.product.update({
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
          ...auditUpdateConnect(uid),
        },
      }),
    ),
  ]);

  return new SuccessResponse(txResults, "出货单恢复成功");
};
