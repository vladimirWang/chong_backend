import { Prisma } from "../../generated/prisma/client";
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
import type { AuthUser } from "../../types/auth";
import type {
  BatchDeleteStockInQuery,
  MultipleStockInBody,
  StockInQuery,
} from "./stockInValidator";

/**
 * 进货业务层（移植自 repo_backend stockInController）
 * 库存联动规则：
 * - 创建/编辑未完成进货单不改动库存
 * - 确认收货时在「锁 Product 行」的事务内解析/创建 ProductVariant（组合 = attrId 集合，
 *   经 ProductVariantJoinAttr 关联表表达），变体已存在则 balance += count，
 *   同时 Product.balance += count 并写 HistoryCost
 * - 软删/恢复仅作用于 PENDING 单
 */

interface StockLineComparable {
  id?: number;
  stockInId?: number;
  productId: number;
  cost: number;
  count: number;
  vendorId: number;
  specSkuIds: string;
}

/** 校验提交的产品行：productId 不可重复，且产品都须存在于当前租户 */
async function assertProductsExist(
  db: TenantPrismaClient,
  lines: { productId: number, specSkuIds: string }[],
) {
  const lineDatas = lines.map((item) => `${item.productId}-${item.specSkuIds}`);
  const uniqueLineDatas = [...new Set(lineDatas)];
  if (lineDatas.length > uniqueLineDatas.length) {
    throw new HttpError(
      400,
      errorCode.VALIDATION_ERROR,
      `提交的数据存在重复的产品（产品id-specSkuIds）: ${lineDatas.join(", ")}`,
    );
  }
  // 去重后的产品id列表
  const uniqueProductIds =[... new Set(uniqueLineDatas.map((item) => parseInt(item)))]
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

/** POST /stockin/multiple：批量进货 */
export async function createMultipleStockIn(
  db: TenantPrismaClient,
  user: AuthUser,
  body: MultipleStockInBody,
) {
  const uid = user.userId;
  const tenantId = user.tenantId!;
  const { productJoinStockIn, submittedAt, remark } = body;

  // 归一化 specSkuIds，使 "1,3" 与 "3,1" 命中同一 ProductVariant
  const normalizedLines = productJoinStockIn.map((item) => ({
    ...item,
    specSkuIds: normalizeSpecSkuIds(item.specSkuIds),
  }));

  await assertProductsExist(db, normalizedLines);

  const totalCost = sum2(normalizedLines, "cost");
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
          create: normalizedLines.map((item) => ({
            cost: item.cost,
            count: item.count,
            product: { connect: { id: item.productId } },
            vendor: { connect: { id: item.vendorId } },
            specSkuIds: item.specSkuIds,
            // 嵌套 create 不触发租户扩展，需手动指定 tenant
            tenant: { connect: { id: tenantId } },
            ...auditCreateConnect(uid),
          })),
        },
      } as never,
    }),
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

  // 归一化 specSkuIds，与库中已归一化的明细行保持一致
  const normalizedLines = body.productJoinStockIn.map((item) => ({
    ...item,
    specSkuIds: normalizeSpecSkuIds(item.specSkuIds),
  }));

  await assertProductsExist(db, normalizedLines);

  const existedRecord = await db.productJoinStockIn.findMany({
    where: { stockInId: id },
  });

  const { submittedAt, remark } = body;
  const totalCost = normalizedLines.reduce(
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
    specSkuIds: r.specSkuIds,
  }));
  const newComparable: StockLineComparable[] = normalizedLines.map((r) => ({
    productId: r.productId,
    cost: r.cost,
    count: r.count,
    vendorId: r.vendorId,
    specSkuIds: r.specSkuIds,
  }));
  const { added, modified, deleted } = compareArrayMinLoop(
    existedComparable,
    newComparable,
    ["productId", "specSkuIds"],
    ["id", "stockInId", "specSkuIds"],
  );

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
          specSkuIds: item.specSkuIds,
          ...auditCreateConnect(uid),
        } as never,
      }),
    ),
    // 修改已有数据
    ...modified.map((item) =>
      db.productJoinStockIn.update({
        where: {
          stockInId_productId_specSkuIds: { stockInId: id, productId: item.productId, specSkuIds: item.specSkuIds },
        },
        data: {
          cost: item.cost,
          count: item.count,
          ...auditUpdateConnect(uid),
        },
      }),
    ),
    // 删除行
    ...deleted.map((item) =>
      db.productJoinStockIn.delete({
        where: {
          stockInId_productId_specSkuIds: { stockInId: id, productId: item.productId, specSkuIds: item.specSkuIds },
        },
      }),
    ),
  ]);

  return new SuccessResponse(null, "进货单更新成功");
}

/** PATCH /stockin/confirmCompleted/:id：确认收货，Product/ProductVariant 加库存，写历史成本 */
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

  // 预解析每行规格的 attr 集合（校验存在性，并取 attrCategoryId 冗余用于关联表）
  const lineAttrs = await Promise.all(
    relatedProducts.map(async (item) => {
      const attrIds = parseSpecSkuIds(item.specSkuIds);
      const attrs = attrIds.length
        ? await db.attr.findMany({
            where: { id: { in: attrIds } },
            select: { id: true, attrCategoryId: true },
          })
        : [];
      if (attrs.length !== attrIds.length) {
        throw new HttpError(
          400,
          errorCode.VALIDATION_ERROR,
          `规格不存在: 产品${item.productId} 规格[${item.specSkuIds}]`,
        );
      }
      return { item, attrIds, attrs };
    }),
  );

  const completedAtVal = completedAt ?? new Date();
  const productIds = [...new Set(relatedProducts.map((i) => i.productId))];

  const record = await db.$transaction(async (tx) => {
    // 锁定涉及的产品行：串行化同一产品的变体解析/创建，
    // 防止并发确认收货为同一组合创建重复变体（组合唯一性的核心保证）
    if (productIds.length > 0) {
      await tx.$queryRaw`SELECT id FROM Product WHERE id IN (${Prisma.join(
        productIds,
      )}) FOR UPDATE`;
    }

    // 修改进货单状态
    const stockInResult = await tx.stockIn.update({
      where: { id },
      data: {
        status: "COMPLETED",
        completedAt: completedAtVal,
        ...auditUpdateConnect(uid),
      },
    });

    for (const { item, attrIds, attrs } of lineAttrs) {
      // 修改产品总库存
      await tx.product.update({
        where: { id: item.productId },
        data: {
          balance: { increment: item.count },
          latestCost: item.cost,
          ...auditUpdateConnect(uid),
        },
      });

      // 变体库存：组合已存在则增量，否则创建变体并写入 attr 关联集合
      const variant = await resolveVariant(tx, item.productId, attrIds);
      if (variant) {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: {
            balance: { increment: item.count },
            ...auditUpdateConnect(uid),
          },
        });
      } else {
        await tx.productVariant.create({
          data: {
            product: { connect: { id: item.productId } },
            balance: item.count,
            ...auditCreateConnect(uid),
            // 嵌套 create 不触发租户扩展，需手动指定 tenant
            productVariantJoinAttrs: {
              create: attrs.map((a) => ({
                attr: { connect: { id: a.id } },
                attrCategoryId: a.attrCategoryId,
                tenant: { connect: { id: tenantId } },
                ...auditCreateConnect(uid),
              })),
            },
          } as never,
        });
      }
    }

    // 写历史成本
    for (const item of relatedProducts) {
      await tx.historyCost.create({
        data: {
          value: item.cost,
          tenant: { connect: { id: tenantId } },
          product: { connect: { id: item.productId } },
          stockIn: { connect: { id } },
          ...auditCreateConnect(uid),
        } as never,
      });
    }

    return stockInResult;
  });

  return new SuccessResponse(record, "进货单确认成功");
}

/** 筛出指定状态（PENDING）+ 删除状态的单子，返回有效的 stockIn id 列表 */
async function getValidPendingStockInIds(
  db: TenantPrismaClient,
  ids: number[],
  isDeleted: boolean,
): Promise<number[]> {
  const pendingStockIns = await db.stockIn.findMany({
    where: {
      id: { in: ids },
      status: "PENDING",
      deletedAt: isDeleted ? { not: null } : null,
    },
    select: { id: true },
  });
  return pendingStockIns.map((s) => s.id);
}

/** DELETE /stockin/batchDelete?id=：仅软删 PENDING 单 */
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

  const validIds = await getValidPendingStockInIds(db, ids, false);
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
  ]);

  return new SuccessResponse(txResults, "进货单批量删除成功");
}

/** POST /stockin/restoreDeleted：恢复软删的 PENDING 单 */
export async function restoreDeletedStockIn(
  db: TenantPrismaClient,
  user: AuthUser,
  ids: number[],
) {
  const uid = user.userId;
  if (!ids || ids.length === 0) {
    return new SuccessResponse(null, "没有需要恢复的进货单");
  }

  const validIds = await getValidPendingStockInIds(db, ids, true);
  if (validIds.length === 0) {
    return new SuccessResponse(null, "没有符合条件的进货单可恢复");
  }

  const txResults = await db.$transaction([
    db.stockIn.updateMany({
      where: { id: { in: validIds } },
      data: { deletedAt: null, ...auditUpdateConnect(uid) },
    }),
    db.productJoinStockIn.updateMany({
      where: { stockInId: { in: validIds } },
      data: { deletedAt: null, ...auditUpdateConnect(uid) },
    }),
  ]);

  return new SuccessResponse(txResults, "进货单恢复成功");
}
