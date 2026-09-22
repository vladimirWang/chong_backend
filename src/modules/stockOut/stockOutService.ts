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
  CreateMultipleStockOut,
  MultipleStockOutBody,
  StockOutQuery,
} from "./stockOutValidator";
import type { BatchDeleteStockInQuery } from "../stockIn/stockInValidator";

/**
 * 出货业务层（移植自 repo_backend stockOutController）
 * 库存联动规则：
 * - 创建/编辑未完成出货单 → balance 扣减、stockOutPending 增加（创建时超卖拦截）
 * - 确认出货 → stockOutPending 转出，记录 latestPrice
 * - 软删/恢复仅处理 PENDING 单，并回滚/重放 balance 与 pending
 */

interface StockOutLineComparable {
  id?: number;
  stockOutId?: number;
  productId: number;
  price: number;
  count: number;
  vendorId: number;
}

/** docs 路径拼 PUBLIC_BASE_URL 前缀（未配置时用空前缀） */
function withBaseUrl(docs: unknown): string[] | undefined {
  if (!Array.isArray(docs)) return undefined;
  const baseUrl = process.env.PUBLIC_BASE_URL ?? "";
  return docs
    .filter((d): d is string => typeof d === "string")
    .map((doc) => `${baseUrl}${doc}`);
}

/** GET /stockout：分页列表 */
export async function getStockOuts(
  db: TenantPrismaClient,
  query: StockOutQuery,
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

  const where: Prisma.StockOutWhereInput = {};

  if (productNameStr || vendorNameStr) {
    where.productJoinStockOut = {
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

  const [total, stockOuts] = await Promise.all([
    db.stockOut.count({ where }),
    db.stockOut.findMany({
      where,
      ...(paginate ? { skip, take } : {}),
      orderBy: { updatedAt: "desc" },
      include: {
        productJoinStockOut: {
          include: { product: { select: { name: true } } },
        },
      },
    }),
  ]);

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
    docs: withBaseUrl(s.docs),
    products: s.productJoinStockOut.map((pjs) => ({
      productId: pjs.productId,
      productName: pjs.product?.name ?? "",
      price: pjs.price,
      count: pjs.count,
    })),
  }));

  return new SuccessResponse({ list, total }, "出货记录列表获取成功");
}

/** POST /stockout/multiple：批量出货，超卖拦截，联动 balance/stockOutPending */
export async function createMultipleStockOut(
  db: TenantPrismaClient,
  user: AuthUser,
  body: CreateMultipleStockOut,
) {
  const uid = user.userId;
  const tenantId = user.tenantId!;
  const {
    productJoinStockOut,
    remark,
    platformId,
    platformOrderNo,
    clientId,
    docs,
    submittedAt,
  } = body;

  // 超卖校验（租户内查产品；balance 为 null 按 0 处理）
  const products = await Promise.all(
    productJoinStockOut.map((item) =>
      db.product.findUnique({ where: { id: item.productId } }),
    ),
  );
  const missing = productJoinStockOut.filter(
    (item, index) => products[index] === null,
  );
  if (missing.length > 0) {
    throw new HttpError(
      400,
      errorCode.PRODUCT_NOT_FOUND,
      `产品不存在: ${missing.map((m) => m.productId).join(", ")}`,
    );
  }
  const oversold = productJoinStockOut.some(
    (item, index) => item.count > (products[index]?.balance ?? 0),
  );
  if (oversold) {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, "产品超卖了");
  }

  const totalPrice = sum2(productJoinStockOut, "price");
  const createdAt = submittedAt ? new Date(submittedAt) : new Date();
  const { serviceCode } = await generateServiceCode("CH", "stockOutCode");

  const results = await db.$transaction([
    db.stockOut.create({
      data: {
        tenant: { connect: { id: tenantId } },
        client: clientId ? { connect: { id: clientId } } : undefined,
        serviceCode,
        createdAt,
        totalPrice,
        remark,
        docs: docs as never,
        ...auditCreateConnect(uid),
        platform: { connect: { id: platformId } },
        platformOrderNo,
        productJoinStockOut: {
          create: productJoinStockOut.map((item) => ({
            price: item.price,
            count: item.count,
            tenant: { connect: { id: tenantId } },
            vendor: { connect: { id: item.vendorId } },
            product: { connect: { id: item.productId } },
            ...auditCreateConnect(uid),
          })),
        },
      } as never,
    }),
    ...productJoinStockOut.map((item) =>
      db.product.update({
        where: { id: item.productId },
        data: {
          balance: { decrement: item.count },
          stockOutPending: { increment: item.count },
          ...auditUpdateConnect(uid),
        },
      }),
    ),
  ]);

  if (!results[0]) {
    throw new HttpError(
      500,
      errorCode.FAILED_TO_CREATE_STOCK_OUT,
      "出货记录批量新建失败",
    );
  }
  return new SuccessResponse(
    results[0],
    "出货记录批量新建成功, 出货单号: " + serviceCode,
  );
}

/** PATCH /stockout/confirmCompleted/:id */
export async function confirmStockOutCompleted(
  db: TenantPrismaClient,
  user: AuthUser,
  id: number,
  completedAt?: Date,
) {
  const uid = user.userId;
  const productsInRecord = await db.productJoinStockOut.findMany({
    where: { stockOutId: id },
  });
  if (!productsInRecord || productsInRecord.length === 0) {
    throw new HttpError(
      400,
      errorCode.PRODUCT_NOT_FOUND,
      "出货单对应产品不存在",
    );
  }

  await db.$transaction([
    db.stockOut.update({
      where: { id },
      data: {
        status: "COMPLETED",
        completedAt: completedAt ?? new Date(),
        ...auditUpdateConnect(uid),
      },
    }),
    ...productsInRecord.map((item) =>
      db.product.update({
        where: { id: item.productId },
        data: {
          stockOutPending: { decrement: item.count },
          latestPrice: item.price,
          ...auditUpdate(uid),
        },
      }),
    ),
  ]);
  return new SuccessResponse(null, "出货确认成功");
}

/** PUT /stockout/:id：明细行增量同步；更新后无产品则整单删除并回滚库存 */
export async function updateStockOut(
  db: TenantPrismaClient,
  user: AuthUser,
  id: number,
  body: MultipleStockOutBody,
) {
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

  const existedRecord = await db.productJoinStockOut.findMany({
    where: { stockOutId: id },
  });

  // 更新后产品为空 → 回滚库存并删除出货单（中间表 onDelete: Cascade 级联删）
  if (!productJoinStockOut || productJoinStockOut.length === 0) {
    await db.$transaction([
      ...existedRecord.map((item) =>
        db.product.update({
          where: { id: item.productId },
          data: {
            balance: { increment: item.count },
            stockOutPending: { increment: -1 * item.count },
            ...auditUpdate(uid),
          },
        }),
      ),
      db.stockOut.delete({ where: { id } }),
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
  const { added, modified, deleted } = compareArrayMinLoop(
    existedComparable,
    newComparable,
    "productId",
    ["id", "stockOutId"],
  );

  const existedInfoMap: Record<number, { count: number; price: number }> = {};
  for (const c of existedRecord) {
    existedInfoMap[c.productId] = { count: c.count, price: c.price };
  }

  // clientId 为 null 时 disconnect；不传（undefined）时保持原值
  const clientValue =
    clientId === null
      ? { disconnect: true }
      : typeof clientId === "number"
        ? { connect: { id: clientId } }
        : undefined;

  await db.$transaction([
    db.stockOut.update({
      where: { id },
      data: {
        remark: remark ?? undefined,
        createdAt: createdAt ? new Date(createdAt) : undefined,
        totalPrice,
        ...(docs !== undefined && { docs: docs as never }),
        client: clientValue as never,
        platform: platformId ? { connect: { id: platformId } } : undefined,
        platformOrderNo,
        ...auditUpdateConnect(uid),
      },
    }),
    ...added.map((item) =>
      db.productJoinStockOut.create({
        data: {
          price: item.price,
          count: item.count,
          productId: item.productId,
          stockOutId: id,
          vendorId: item.vendorId,
          ...auditCreate(uid),
        } as never,
      }),
    ),
    ...modified.map((item) =>
      db.productJoinStockOut.update({
        where: {
          stockOutId_productId: { stockOutId: id, productId: item.productId },
        },
        data: {
          price: item.price,
          count: item.count,
          ...auditUpdateConnect(uid),
        },
      }),
    ),
    ...deleted.map((item) =>
      db.productJoinStockOut.delete({
        where: {
          stockOutId_productId: { stockOutId: id, productId: item.productId },
        },
      }),
    ),
    // added：balance-count、pending+count
    ...added.map((item) =>
      db.product.update({
        where: { id: item.productId },
        data: {
          balance: { increment: -1 * item.count },
          stockOutPending: { increment: item.count },
          ...auditUpdate(uid),
        },
      }),
    ),
    // modified：把老数量加回再扣新数量
    ...modified.map((item) => {
      const existedCount = existedInfoMap[item.productId].count ?? 0;
      const balanceDelta = existedCount - item.count;
      return db.product.update({
        where: { id: item.productId },
        data: {
          balance: { increment: balanceDelta },
          stockOutPending: { increment: -1 * balanceDelta },
          ...auditUpdate(uid),
        },
      });
    }),
    // deleted：数量加回 balance、pending 减掉
    ...deleted.map((item) =>
      db.product.update({
        where: { id: item.productId },
        data: {
          balance: { increment: item.count },
          stockOutPending: { increment: -1 * item.count },
          ...auditUpdate(uid),
        },
      }),
    ),
  ]);
  return new SuccessResponse(null, "出货单更新成功");
}

/** GET /stockout/:id */
export async function getStockOutDetailById(
  db: TenantPrismaClient,
  id: number,
) {
  const result = await db.stockOut.findUnique({
    where: { id },
    include: { productJoinStockOut: true },
  });
  const data = result
    ? { ...result, docs: withBaseUrl(result.docs) }
    : result;
  // 老架构成功消息文案如此，保持契约一致
  return new SuccessResponse(data, "出货单更新成功");
}

/** 筛出 PENDING 且删除状态匹配的出货单，并汇总每产品待处理数量 */
async function getValidIdsAndPendingStockOut(
  db: TenantPrismaClient,
  ids: number[],
  isDeleted: boolean,
) {
  const pendingStockOuts = await db.stockOut.findMany({
    where: {
      id: { in: ids },
      status: "PENDING",
      deletedAt: isDeleted ? { not: null } : null,
    },
    select: { id: true },
  });
  const validIds = pendingStockOuts.map((s) => s.id);
  if (validIds.length === 0) {
    return { validIds: [], pendingCount: {} as Record<number, number> };
  }

  const joinRows = await db.productJoinStockOut.findMany({
    where: {
      stockOutId: { in: validIds },
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

/** DELETE /stockout/batchDelete?id=：软删 PENDING 单，回滚 balance、扣减 pending */
export async function batchDeleteStockOut(
  db: TenantPrismaClient,
  user: AuthUser,
  query: BatchDeleteStockInQuery,
) {
  const uid = user.userId;
  const ids = query.id as number[];
  if (!ids || ids.length === 0) {
    return new SuccessResponse(null, "没有需要删除的出货单");
  }

  const { validIds, pendingCount } = await getValidIdsAndPendingStockOut(
    db,
    ids,
    false,
  );
  if (validIds.length === 0) {
    return new SuccessResponse(null, "没有符合条件的出货单可删除");
  }
  const now = new Date();

  const txResults = await db.$transaction([
    db.stockOut.updateMany({
      where: { id: { in: validIds } },
      data: auditSoftDelete(uid, now),
    }),
    db.productJoinStockOut.updateMany({
      where: { stockOutId: { in: validIds }, deletedAt: null },
      data: auditSoftDelete(uid, now),
    }),
    ...Object.entries(pendingCount).map(([productId, totalCount]) =>
      db.product.update({
        where: { id: Number(productId) },
        data: {
          stockOutPending: { decrement: totalCount },
          balance: { increment: totalCount },
          ...auditUpdate(uid),
        },
      }),
    ),
  ]);

  return new SuccessResponse(txResults, "出货单批量删除成功");
}

/** POST /stockout/restoreDeleted：恢复软删的 PENDING 单，重放 balance/pending */
export async function restoreDeletedStockOut(
  db: TenantPrismaClient,
  user: AuthUser,
  ids: number[],
) {
  const uid = user.userId;
  if (!ids || ids.length === 0) {
    return new SuccessResponse(null, "没有需要恢复的出货单");
  }

  const { validIds, pendingCount } = await getValidIdsAndPendingStockOut(
    db,
    ids,
    true,
  );
  if (validIds.length === 0) {
    return new SuccessResponse(null, "没有符合条件的出货单可恢复");
  }

  const txResults = await db.$transaction([
    db.stockOut.updateMany({
      where: { id: { in: validIds } },
      data: { deletedAt: null, ...auditUpdate(uid) },
    }),
    db.productJoinStockOut.updateMany({
      where: { stockOutId: { in: validIds } },
      data: { deletedAt: null, ...auditUpdate(uid) },
    }),
    ...Object.entries(pendingCount).map(([productId, totalCount]) =>
      db.product.update({
        where: { id: Number(productId) },
        data: {
          stockOutPending: { increment: totalCount },
          balance: { decrement: totalCount },
          ...auditUpdate(uid),
        },
      }),
    ),
  ]);

  return new SuccessResponse(txResults, "出货单恢复成功");
}
