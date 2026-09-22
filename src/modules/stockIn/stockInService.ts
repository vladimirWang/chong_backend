import type { Prisma } from "../../generated/prisma/client";
import type { TenantPrismaClient } from "../../utils/prisma";
import { SuccessResponse, errorCode } from "../../models/Response";
import { HttpError } from "../../models/HttpError";
import { getPaginationValues } from "../../utils/db";
import {
  auditCreate,
  auditCreateConnect,
  auditSoftDelete,
  auditUpdate,
  auditUpdateConnect,
} from "../../utils/auditUser";
import { compareArrayMinLoop, sum2 } from "../../utils/algo";
import { generateServiceCode } from "../../utils/common";
import type { AuthUser } from "../../types/auth";
import type {
  BatchDeleteStockInQuery,
  MultipleStockInBody,
  StockInQuery,
} from "./stockInValidator";

/**
 * 进货业务层（移植自 repo_backend stockInController）
 * 库存联动规则：
 * - 创建/编辑未完成进货单 → product.stockInPending 增减
 * - 确认收货 → pending 转入 balance，并写 HistoryCost
 * - 软删/恢复仅处理 PENDING 单，COMPLETED 单不回滚 pending
 */

interface StockLineComparable {
  id?: number;
  stockInId?: number;
  productId: number;
  cost: number;
  count: number;
  vendorId: number;
}

/** 校验提交的产品行：productId 不可重复，且产品都须存在于当前租户 */
async function assertProductsExist(
  db: TenantPrismaClient,
  lines: { productId: number }[],
) {
  const productIds = lines.map((item) => item.productId);
  const uniqueProductIds = [...new Set(productIds)];
  if (productIds.length > uniqueProductIds.length) {
    throw new HttpError(
      400,
      errorCode.VALIDATION_ERROR,
      `提交的数据存在重复的产品id: ${productIds.join(", ")}`,
    );
  }
  const existing = await db.product.findMany({
    where: { id: { in: uniqueProductIds } },
    select: { id: true },
  });
  const existingIds = existing.map((p) => p.id);
  const missingIds = uniqueProductIds.filter((id) => !existingIds.includes(id));
  if (missingIds.length > 0) {
    throw new HttpError(
      400,
      errorCode.VALIDATION_ERROR,
      `产品不存在: ${missingIds.join(", ")}`,
    );
  }
}

/** GET /stockin：分页列表，支持产品名/供应商名/删除区间/完成区间过滤 */
export async function getStockIns(
  db: TenantPrismaClient,
  query: StockInQuery,
) {
  const {
    pagination: paginationNum = 1,
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
  const paginate = paginationNum !== 0;
  const { skip, take } = getPaginationValues({ limit, page });

  const productNameStr =
    typeof productName === "string" ? productName.trim() : undefined;
  const vendorNameStr =
    typeof vendorName === "string" ? vendorName.trim() : undefined;

  // tenantPrisma 自动注入 tenantId；软删除扩展自动注入 deletedAt: null（除非显式覆盖）
  const where: Prisma.StockInWhereInput = {};

  if (productNameStr || vendorNameStr) {
    where.productJoinStockIn = {
      some: {
        product: {
          ...(productNameStr ? { name: { contains: productNameStr } } : {}),
          ...(vendorNameStr
            ? { vendor: { name: { contains: vendorNameStr } } }
            : {}),
        },
      },
    };
  }

  if (deletedStart || deletedEnd) {
    where.deletedAt = {
      ...(deletedStart ? { gte: new Date(deletedStart) } : {}),
      ...(deletedEnd ? { lte: new Date(deletedEnd) } : {}),
    };
  } else if (isDeleted === "1") {
    where.deletedAt = { not: null };
  }

  if (completedStart || completedEnd) {
    where.completedAt = {
      ...(completedStart ? { gte: new Date(completedStart) } : {}),
      ...(completedEnd ? { lte: new Date(completedEnd) } : {}),
    };
  }

  const [total, stockIns] = await Promise.all([
    db.stockIn.count({ where }),
    db.stockIn.findMany({
      where,
      ...(paginate ? { skip, take } : {}),
      orderBy: { updatedAt: "desc" },
      include: {
        productJoinStockIn: {
          include: { product: { select: { name: true } } },
        },
      },
    }),
  ]);

  const list = stockIns.map((s) => ({
    id: s.id,
    remark: s.remark,
    createdAt: s.createdAt,
    submittedAt: s.submittedAt,
    updatedAt: s.updatedAt,
    deletedAt: s.deletedAt,
    status: s.status,
    completedAt: s.completedAt,
    totalCost: s.totalCost,
    serviceCode: s.serviceCode,
    products: s.productJoinStockIn.map((pjs) => ({
      productId: pjs.productId,
      productName: pjs.product?.name ?? "",
      cost: pjs.cost,
      count: pjs.count,
    })),
  }));

  return new SuccessResponse({ list, total }, "进货记录列表获取成功");
}

/** POST /stockin/multiple：批量进货，联动 product.stockInPending */
export async function createMultipleStockIn(
  db: TenantPrismaClient,
  user: AuthUser,
  body: MultipleStockInBody,
) {
  const uid = user.userId;
  const tenantId = user.tenantId!;
  const { productJoinStockIn, submittedAt, remark } = body;

  await assertProductsExist(db, productJoinStockIn);

  const totalCost = sum2(productJoinStockIn, "cost");
  const submittedAtVal = submittedAt ? new Date(submittedAt) : new Date();
  const { serviceCode } = await generateServiceCode("JH", "stockInCode");

  const results = await db.$transaction([
    db.stockIn.create({
      data: {
        submittedAt: submittedAtVal,
        remark,
        totalCost,
        serviceCode,
        ...auditCreateConnect(uid),
        tenant: { connect: { id: tenantId } },
        productJoinStockIn: {
          create: productJoinStockIn.map((item) => ({
            cost: item.cost,
            count: item.count,
            product: { connect: { id: item.productId } },
            vendor: { connect: { id: item.vendorId } },
            // 嵌套 create 不触发租户扩展，需手动指定 tenant
            tenant: { connect: { id: tenantId } },
            ...auditCreateConnect(uid),
          })),
        },
      } as never,
    }),
    ...productJoinStockIn.map((item) =>
      db.product.update({
        data: {
          stockInPending: { increment: item.count },
          ...auditUpdate(uid),
        },
        where: { id: item.productId },
      }),
    ),
  ]);

  if (!results[0]) {
    throw new HttpError(
      500,
      errorCode.FAILED_TO_CREATE_STOCK_IN,
      "进货记录批量新建失败",
    );
  }
  return new SuccessResponse(
    results[0],
    "进货记录批量新建成功, 进货单号: " + serviceCode,
  );
}

/** GET /stockin/:id */
export async function getStockInById(
  db: TenantPrismaClient,
  id: number,
) {
  const result = await db.stockIn.findUnique({
    where: { id },
    include: { productJoinStockIn: true },
  });
  return new SuccessResponse(result, "进货记录查询成功");
}

/** PUT /stockin/:id：按 productId 对比新旧明细行，增量同步并联动 pending */
export async function updateStockIn(
  db: TenantPrismaClient,
  user: AuthUser,
  id: number,
  body: MultipleStockInBody,
) {
  const uid = user.userId;
  await assertProductsExist(db, body.productJoinStockIn);

  const existedRecord = await db.productJoinStockIn.findMany({
    where: { stockInId: id },
  });

  const { productJoinStockIn, submittedAt, remark } = body;
  const totalCost = productJoinStockIn.reduce(
    (a, c) => a + c.cost * c.count,
    0,
  );

  const existedComparable: StockLineComparable[] = existedRecord.map((r) => ({
    id: r.id,
    stockInId: r.stockInId,
    productId: r.productId,
    cost: r.cost,
    count: r.count,
    vendorId: r.vendorId,
  }));
  const newComparable: StockLineComparable[] = productJoinStockIn.map((r) => ({
    productId: r.productId,
    cost: r.cost,
    count: r.count,
    vendorId: r.vendorId,
  }));
  const { added, modified, deleted } = compareArrayMinLoop(
    existedComparable,
    newComparable,
    "productId",
    ["id", "stockInId"],
  );

  const existedInfoMap: Record<number, { count: number; cost: number }> = {};
  for (const c of existedRecord) {
    existedInfoMap[c.productId] = { count: c.count, cost: c.cost };
  }

  await db.$transaction([
    db.stockIn.update({
      where: { id },
      data: {
        totalCost,
        submittedAt: submittedAt ? new Date(submittedAt) : undefined,
        remark,
        ...auditUpdateConnect(uid),
      },
    }),
    // 新增明细行（标量 audit，tenant 由扩展注入）
    ...added.map((item) =>
      db.productJoinStockIn.create({
        data: {
          cost: item.cost,
          count: item.count,
          productId: item.productId,
          vendorId: item.vendorId,
          stockInId: id,
          ...auditCreate(uid),
        } as never,
      }),
    ),
    ...modified.map((item) =>
      db.productJoinStockIn.update({
        where: {
          stockInId_productId: { stockInId: id, productId: item.productId },
        },
        data: {
          cost: item.cost,
          count: item.count,
          ...auditUpdateConnect(uid),
        },
      }),
    ),
    ...deleted.map((item) =>
      db.productJoinStockIn.delete({
        where: {
          stockInId_productId: { stockInId: id, productId: item.productId },
        },
      }),
    ),
    // pending 联动：新增 +count，修改 +(新-旧)，删除 -旧
    ...added.map((item) =>
      db.product.update({
        where: { id: item.productId },
        data: {
          stockInPending: { increment: item.count },
          ...auditUpdate(uid),
        },
      }),
    ),
    ...modified.map((item) =>
      db.product.update({
        where: { id: item.productId },
        data: {
          stockInPending: {
            increment: item.count - existedInfoMap[item.productId].count,
          },
          ...auditUpdate(uid),
        },
      }),
    ),
    ...deleted.map((item) =>
      db.product.update({
        where: { id: item.productId },
        data: {
          stockInPending: {
            increment: -1 * existedInfoMap[item.productId].count,
          },
          ...auditUpdate(uid),
        },
      }),
    ),
  ]);

  return new SuccessResponse(null, "进货单更新成功");
}

/** PATCH /stockin/confirmCompleted/:id：确认收货，pending → balance，写历史成本 */
export async function confirmCompleted(
  db: TenantPrismaClient,
  user: AuthUser,
  id: number,
  completedAt?: Date,
) {
  const uid = user.userId;
  const tenantId = user.tenantId!;
  const relatedProducts = await db.productJoinStockIn.findMany({
    where: { stockInId: id },
  });

  const completedAtVal = completedAt ?? new Date();
  const record = await db.$transaction([
    db.stockIn.update({
      where: { id },
      data: {
        status: "COMPLETED",
        completedAt: completedAtVal,
        ...auditUpdateConnect(uid),
      },
    }),
    ...relatedProducts.map((item) =>
      db.product.update({
        where: { id: item.productId },
        data: {
          balance: { increment: item.count },
          stockInPending: { increment: -1 * item.count },
          latestCost: item.cost,
          ...auditUpdateConnect(uid),
        },
      }),
    ),
    ...relatedProducts.map((item) =>
      db.historyCost.create({
        data: {
          value: item.cost,
          tenant: { connect: { id: tenantId } },
          product: { connect: { id: item.productId } },
          stockIn: { connect: { id } },
          ...auditCreateConnect(uid),
        } as never,
      }),
    ),
  ]);
  return new SuccessResponse(record, "进货单确认成功");
}

/** 筛出指定状态（PENDING）+ 删除状态的单子，并汇总每产品待处理数量 */
async function getValidsAndPendingCount(
  db: TenantPrismaClient,
  ids: number[],
  isDeleted: boolean,
) {
  const pendingStockIns = await db.stockIn.findMany({
    where: {
      id: { in: ids },
      status: "PENDING",
      deletedAt: isDeleted ? { not: null } : null,
    },
    select: { id: true },
  });
  const validIds = pendingStockIns.map((s) => s.id);
  if (validIds.length === 0) {
    return { validIds: [], pendingCount: {} as Record<number, number> };
  }

  const joinRows = await db.productJoinStockIn.findMany({
    where: {
      stockInId: { in: validIds },
      deletedAt: isDeleted ? { not: null } : null,
    },
    select: { productId: true, count: true },
  });

  const pendingCount: Record<number, number> = {};
  for (const row of joinRows) {
    pendingCount[row.productId] =
      (pendingCount[row.productId] ?? 0) + row.count;
  }
  return { validIds, pendingCount };
}

/** DELETE /stockin/batchDelete?id=：仅软删 PENDING 单并回滚 pending */
export async function batchDeleteStockIn(
  db: TenantPrismaClient,
  user: AuthUser,
  query: BatchDeleteStockInQuery,
) {
  const uid = user.userId;
  const ids = query.id as number[];
  if (!ids || ids.length === 0) {
    return new SuccessResponse(null, "没有需要删除的进货单");
  }

  const { validIds, pendingCount } = await getValidsAndPendingCount(
    db,
    ids,
    false,
  );
  if (validIds.length === 0) {
    return new SuccessResponse(null, "没有符合条件的进货单可删除");
  }

  const now = new Date();
  const txResults = await db.$transaction([
    db.stockIn.updateMany({
      where: { id: { in: validIds } },
      data: auditSoftDelete(uid, now),
    }),
    db.productJoinStockIn.updateMany({
      where: { stockInId: { in: validIds }, deletedAt: null },
      data: auditSoftDelete(uid, now),
    }),
    ...Object.entries(pendingCount).map(([productId, totalCount]) =>
      db.product.update({
        where: { id: Number(productId) },
        data: {
          stockInPending: { decrement: totalCount },
          ...auditUpdate(uid),
        },
      }),
    ),
  ]);

  return new SuccessResponse(txResults, "进货单批量删除成功");
}

/** POST /stockin/restoreDeleted：恢复软删的 PENDING 单并加回 pending */
export async function restoreDeletedStockIn(
  db: TenantPrismaClient,
  user: AuthUser,
  ids: number[],
) {
  const uid = user.userId;
  if (!ids || ids.length === 0) {
    return new SuccessResponse(null, "没有需要恢复的进货单");
  }

  const { validIds, pendingCount } = await getValidsAndPendingCount(
    db,
    ids,
    true,
  );
  if (validIds.length === 0) {
    return new SuccessResponse(null, "没有符合条件的进货单可恢复");
  }

  const txResults = await db.$transaction([
    db.stockIn.updateMany({
      where: { id: { in: validIds } },
      data: { deletedAt: null, ...auditUpdate(uid) },
    }),
    db.productJoinStockIn.updateMany({
      where: { stockInId: { in: validIds } },
      data: { deletedAt: null, ...auditUpdate(uid) },
    }),
    ...Object.entries(pendingCount).map(([productId, totalCount]) =>
      db.product.update({
        where: { id: Number(productId) },
        data: {
          stockInPending: { increment: totalCount },
          ...auditUpdate(uid),
        },
      }),
    ),
  ]);

  return new SuccessResponse(txResults, "进货单恢复成功");
}
