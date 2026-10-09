import type { Prisma, ProductVariant } from "../../generated/prisma/client";
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
import {
  compareArrayMinLoop,
  normalizeSpecSkuIds,
  parseSpecSkuIds,
  sum2,
} from "../../utils/algo";
import { resolveVariant } from "../../utils/variant";
import { generateServiceCode } from "../../utils/common";
import { invalidateProductDetailCache } from "../product/productService";
import type { AuthUser } from "../../types/auth";
import type {
  CreateMultipleStockOut,
  MultipleStockOutBody,
  StockOutQuery,
} from "./stockOutValidator";
import type { BatchDeleteStockInQuery } from "../stockIn/stockInValidator";

/**
 * 出货业务层（移植自 repo_backend stockOutController）
 * 创建/编辑出货单 → 变体经集合相等解析（ProductVariantJoinAttr 组合）后做超卖校验，
 * 通过后 ProductVariant.balance 与 Product.balance 同步扣减；
 * 确认出货仅记 latestPrice；软删 PENDING 单回滚变体与产品余额，恢复则重放扣减。
 */

interface StockOutLineComparable {
  id?: number;
  stockOutId?: number;
  productId: number;
  price: number;
  count: number;
  vendorId: number;
  specSkuIds: string;
}

interface VariantNeed {
  productId: number;
  specSkuIds: string;
  needed: number;
}

/**
 * 按 `productId-specSkuIds` 批量集合相等解析变体（同 key 去重）。
 * 变体不存在（该产品无此规格组合的库存）直接抛"该规格无库存"。
 */
async function resolveVariantMap(
  db: TenantPrismaClient,
  items: { productId: number; specSkuIds: string }[],
): Promise<Map<string, ProductVariant>> {
  const map = new Map<string, ProductVariant>();
  for (const item of items) {
    const key = `${item.productId}-${item.specSkuIds}`;
    if (map.has(key)) continue;
    const variant = await resolveVariant(
      db,
      item.productId,
      parseSpecSkuIds(item.specSkuIds),
    );
    if (!variant) {
      throw new HttpError(
        400,
        errorCode.VALIDATION_ERROR,
        `该规格无库存: ${key}`,
      );
    }
    map.set(key, variant);
  }
  return map;
}

/** 校验变体可扣减数量充足（needed<=0 跳过），否则抛"产品超卖了" */
function assertVariantsNotOversold(
  variantMap: Map<string, ProductVariant>,
  needs: VariantNeed[],
) {
  for (const n of needs) {
    if (n.needed <= 0) continue;
    const variant = variantMap.get(`${n.productId}-${n.specSkuIds}`);
    if (variant && n.needed > variant.balance) {
      throw new HttpError(400, errorCode.VALIDATION_ERROR, "产品超卖了");
    }
  }
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

/** POST /stockout/multiple：批量出货，超卖拦截，联动 balance */
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

  const normalizedLines = productJoinStockOut.map((item) => ({
    ...item,
    specSkuIds: normalizeSpecSkuIds(item.specSkuIds),
  }));

  // 集合相等解析变体（变体不存在即产品无此规格库存，直接抛错），再做超卖校验
  const variantMap = await resolveVariantMap(db, normalizedLines);
  assertVariantsNotOversold(
    variantMap,
    normalizedLines.map((item) => ({
      productId: item.productId,
      specSkuIds: item.specSkuIds,
      needed: item.count,
    })),
  );

  const totalPrice = sum2(normalizedLines, "price");
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
          create: normalizedLines.map((item) => ({
            price: item.price,
            count: item.count,
            tenant: { connect: { id: tenantId } },
            vendor: { connect: { id: item.vendorId } },
            product: { connect: { id: item.productId } },
            specSkuIds: item.specSkuIds,
            ...auditCreateConnect(uid),
          })),
        },
      } as never,
    }),
    ...normalizedLines.map((item) =>
      db.product.update({
        where: { id: item.productId },
        data: {
          balance: { decrement: item.count },
          ...auditUpdateConnect(uid),
        },
      }),
    ),
    ...normalizedLines.map((item) =>
      db.productVariant.update({
        where: {
          id: variantMap.get(`${item.productId}-${item.specSkuIds}`)!.id,
        },
        data: {
          balance: { decrement: item.count },
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
  // 事务提交后失效相关产品详情缓存（balance/variants 已扣减）
  await invalidateProductDetailCache(
    tenantId,
    normalizedLines.map((item) => item.productId),
  );
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
          latestPrice: item.price,
          ...auditUpdate(uid),
        },
      }),
    ),
  ]);
  // 事务提交后失效相关产品详情缓存（latestPrice 已变更）
  await invalidateProductDetailCache(
    user.tenantId!,
    productsInRecord.map((item) => item.productId),
  );
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

  const existedInfoMap: Record<string, { count: number; price: number }> = {};
  for (const c of existedRecord) {
    existedInfoMap[`${c.productId}-${c.specSkuIds}`] = {
      count: c.count,
      price: c.price,
    };
  }

  const normalizedLines = (productJoinStockOut ?? []).map((item) => ({
    ...item,
    specSkuIds: normalizeSpecSkuIds(item.specSkuIds),
  }));

  // 更新后产品为空 → 回滚库存并删除出货单（中间表 onDelete: Cascade 级联删）
  if (normalizedLines.length === 0) {
    const variantMap = await resolveVariantMap(db, existedRecord);
    await db.$transaction([
      ...existedRecord.map((item) =>
        db.product.update({
          where: { id: item.productId },
          data: {
            balance: { increment: item.count },
            ...auditUpdate(uid),
          },
        }),
      ),
      ...existedRecord.map((item) =>
        db.productVariant.update({
          where: {
            id: variantMap.get(`${item.productId}-${item.specSkuIds}`)!.id,
          },
          data: {
            balance: { increment: item.count },
            ...auditUpdateConnect(uid),
          },
        }),
      ),
      db.stockOut.delete({ where: { id } }),
    ]);
    // 事务提交后失效相关产品详情缓存（balance/variants 已回滚）
    await invalidateProductDetailCache(
      user.tenantId!,
      existedRecord.map((item) => item.productId),
    );
    return new SuccessResponse(null, "出货单已删除（无产品数据）");
  }

  const totalPrice = normalizedLines.reduce(
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
      specSkuIds: r.specSkuIds,
    }),
  );
  const newComparable: StockOutLineComparable[] = normalizedLines.map(
    (r) => ({
      productId: r.productId,
      price: r.price,
      count: r.count,
      vendorId: r.vendorId,
      specSkuIds: r.specSkuIds,
    }),
  );
  const { added, modified, deleted } = compareArrayMinLoop(
    existedComparable,
    newComparable,
    ["productId", "specSkuIds"],
    ["id", "stockOutId", "specSkuIds"],
  );

  // 变体可用性：新增行按全量、修改行按增量（新-旧，仅正向）统一校验
  const variantNeeds: VariantNeed[] = [
    ...added.map((item) => ({
      productId: item.productId,
      specSkuIds: item.specSkuIds,
      needed: item.count,
    })),
    ...modified.flatMap((item) => {
      const oldCount =
        existedInfoMap[`${item.productId}-${item.specSkuIds}`]?.count ?? 0;
      const needed = item.count - oldCount;
      return needed > 0
        ? [
            {
              productId: item.productId,
              specSkuIds: item.specSkuIds,
              needed,
            },
          ]
        : [];
    }),
  ];
  // 解析全部涉及行（added/modified/deleted）的变体，并按增量做超卖校验
  const variantMap = await resolveVariantMap(db, [
    ...added,
    ...modified,
    ...deleted,
  ]);
  assertVariantsNotOversold(variantMap, variantNeeds);

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
          specSkuIds: item.specSkuIds,
          ...auditCreateConnect(uid),
        } as never,
      }),
    ),
    ...modified.map((item) =>
      db.productJoinStockOut.update({
        where: {
          stockOutId_productId_specSkuIds: { stockOutId: id, productId: item.productId, specSkuIds: item.specSkuIds },
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
          stockOutId_productId_specSkuIds: { stockOutId: id, productId: item.productId, specSkuIds: item.specSkuIds },
        },
      }),
    ),
    // added：balance-count
    ...added.map((item) =>
      db.product.update({
        where: { id: item.productId },
        data: {
          balance: { increment: -1 * item.count },
          ...auditUpdateConnect(uid),
        },
      }),
    ),
    // modified：把老数量加回再扣新数量
    ...modified.map((item) => {
      const existedCount =
        existedInfoMap[`${item.productId}-${item.specSkuIds}`].count ?? 0;
      const balanceDelta = existedCount - item.count;
      return db.product.update({
        where: { id: item.productId },
        data: {
          balance: { increment: balanceDelta },
          ...auditUpdateConnect(uid),
        },
      });
    }),
    // deleted：数量加回 balance
    ...deleted.map((item) =>
      db.product.update({
        where: { id: item.productId },
        data: {
          balance: { increment: item.count },
          ...auditUpdateConnect(uid),
        },
      }),
    ),
    // 变体级库存联动
    // added：变体 balance -count
    ...added.map((item) =>
      db.productVariant.update({
        where: {
          id: variantMap.get(`${item.productId}-${item.specSkuIds}`)!.id,
        },
        data: {
          balance: { decrement: item.count },
          ...auditUpdateConnect(uid),
        },
      }),
    ),
    // modified：变体 balance += (旧-新)
    ...modified.map((item) => {
      const existedCount =
        existedInfoMap[`${item.productId}-${item.specSkuIds}`]?.count ?? 0;
      const balanceDelta = existedCount - item.count;
      return db.productVariant.update({
        where: {
          id: variantMap.get(`${item.productId}-${item.specSkuIds}`)!.id,
        },
        data: {
          balance: { increment: balanceDelta },
          ...auditUpdateConnect(uid),
        },
      });
    }),
    // deleted：变体 balance 加回旧数量
    ...deleted.map((item) =>
      db.productVariant.update({
        where: {
          id: variantMap.get(`${item.productId}-${item.specSkuIds}`)!.id,
        },
        data: {
          balance: { increment: item.count },
          ...auditUpdateConnect(uid),
        },
      }),
    ),
  ]);
  // 事务提交后失效所有涉及产品的详情缓存（balance/variants 增量已变更）
  await invalidateProductDetailCache(
    user.tenantId!,
    [...added, ...modified, ...deleted].map((item) => item.productId),
  );
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
    return {
      validIds: [],
      pendingCount: {} as Record<number, number>,
      specSkuItems: [] as { productId: number; specSkuIds: string; count: number }[],
      variantAgg: [] as { productId: number; specSkuIds: string; count: number }[],
    };
  }

  const joinRows = await db.productJoinStockOut.findMany({
    where: {
      stockOutId: { in: validIds },
      deletedAt: isDeleted ? { not: null } : null,
    },
    select: { productId: true, specSkuIds: true, count: true },
  });

  const pendingCount: Record<number, number> = {};
  for (const row of joinRows) {
    pendingCount[row.productId] =
      (pendingCount[row.productId] ?? 0) + row.count;
  }

  const variantAggMap = new Map<
    string,
    { productId: number; specSkuIds: string; count: number }
  >();
  for (const row of joinRows) {
    const key = `${row.productId}-${row.specSkuIds}`;
    const cur = variantAggMap.get(key);
    if (cur) cur.count += row.count;
    else
      variantAggMap.set(key, {
        productId: row.productId,
        specSkuIds: row.specSkuIds,
        count: row.count,
      });
  }
  const variantAgg = [...variantAggMap.values()];

  return { validIds, pendingCount, specSkuItems: joinRows, variantAgg };
}

/** DELETE /stockout/batchDelete?id=：软删 PENDING 单，回滚 balance */
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

  const { validIds, pendingCount, variantAgg } =
    await getValidIdsAndPendingStockOut(db, ids, false);
  if (validIds.length === 0) {
    return new SuccessResponse(null, "没有符合条件的出货单可删除");
  }
  const variantMap = await resolveVariantMap(db, variantAgg);
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
          balance: { increment: totalCount },
          ...auditUpdateConnect(uid),
        },
      }),
    ),
    ...variantAgg.map((v) =>
      db.productVariant.update({
        where: {
          id: variantMap.get(`${v.productId}-${v.specSkuIds}`)!.id,
        },
        data: {
          balance: { increment: v.count },
          ...auditUpdateConnect(uid),
        },
      }),
    ),
  ]);

  // 事务提交后失效相关产品详情缓存（balance/variants 已回滚）
  await invalidateProductDetailCache(
    user.tenantId!,
    Object.keys(pendingCount).map(Number),
  );
  return new SuccessResponse(txResults, "出货单批量删除成功");
}

/** POST /stockout/restoreDeleted：恢复软删的 PENDING 单，重放 balance */
export async function restoreDeletedStockOut(
  db: TenantPrismaClient,
  user: AuthUser,
  ids: number[],
) {
  const uid = user.userId;
  if (!ids || ids.length === 0) {
    return new SuccessResponse(null, "没有需要恢复的出货单");
  }

  const { validIds, pendingCount, variantAgg } =
    await getValidIdsAndPendingStockOut(db, ids, true);
  if (validIds.length === 0) {
    return new SuccessResponse(null, "没有符合条件的出货单可恢复");
  }
  const variantMap = await resolveVariantMap(db, variantAgg);

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
          balance: { decrement: totalCount },
          ...auditUpdateConnect(uid),
        },
      }),
    ),
    ...variantAgg.map((v) =>
      db.productVariant.update({
        where: {
          id: variantMap.get(`${v.productId}-${v.specSkuIds}`)!.id,
        },
        data: {
          balance: { decrement: v.count },
          ...auditUpdateConnect(uid),
        },
      }),
    ),
  ]);

  // 事务提交后失效相关产品详情缓存（balance/variants 已重放扣减）
  await invalidateProductDetailCache(
    user.tenantId!,
    Object.keys(pendingCount).map(Number),
  );
  return new SuccessResponse(txResults, "出货单恢复成功");
}
