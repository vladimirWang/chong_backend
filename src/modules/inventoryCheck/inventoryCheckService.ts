import { Prisma } from "../../generated/prisma/client";
import type { TenantPrismaClient } from "../../utils/prisma";
import { SuccessResponse, ErrorResponse, errorCode } from "../../models/Response";
import { HttpError } from "../../models/HttpError";
import { getPaginationValues } from "../../utils/db";
import { auditCreateConnect, auditUpdateConnect, auditSoftDelete } from "../../utils/auditUser";
import { generateServiceCode } from "../../utils/common";
import type { AuthUser } from "../../types/auth";
import type {
  CreateInventoryCheckBody,
  InventoryCheckItemsBody,
  InventoryCheckQuery,
} from "./inventoryCheckValidator";

/**
 * 盘点业务层
 * 核心规则：
 * - 创建盘点单时对符合范围的 ProductVariant 拍快照（bookQty），后续 StockIn/StockOut 不影响
 * - 软冻结：不阻塞正常出入库，差异 = actualQty - bookQty
 * - 过账硬校验：所有 item.actualQty 必须非 null，不允许漏盘
 * - 过账事务内 ProductVariant.balance += diffQty，同时重算 Product.balance
 */

/** 根据条件构建 ProductVariant 查询条件 */
function buildVariantWhere(
  tenantId: number,
  vendorIds?: number[],
  productIds?: number[],
): Prisma.ProductVariantWhereInput {
  const where: Prisma.ProductVariantWhereInput = {
    tenantId,
    deletedAt: null,
  };
  if (productIds?.length) {
    where.productId = { in: productIds };
  }
  if (vendorIds?.length) {
    where.product = { vendorId: { in: vendorIds } };
  }
  return where;
}

/**
 * POST /inventoryCheck：创建盘点单
 * 根据 scope 生成 InventoryCheckItem（每个 ProductVariant 一条），bookQty = 创建时 balance 快照
 */
export async function createInventoryCheck(
  db: TenantPrismaClient,
  user: AuthUser,
  body: CreateInventoryCheckBody,
) {
  const uid = user.userId;
  const tenantId = user.tenantId!;
  const { name, vendorIds, productIds, remark } = body;

  const variantWhere = buildVariantWhere(tenantId, vendorIds, productIds);

  // 事务内生成盘点单 + items（拍快照）
  const { serviceCode } = await generateServiceCode("PC", "inventoryCheckCode");
  const snapshotAt = new Date();

  const result = await db.$transaction(async (tx) => {
    const variants = await tx.productVariant.findMany({
      where: variantWhere,
      select: { id: true, productId: true, balance: true },
    });

    if (variants.length === 0) {
      throw new HttpError(
        400,
        errorCode.VALIDATION_ERROR,
        "盘点范围内没有可盘点的 SKU",
      );
    }

    const items = variants.map((v) => ({
      variant: { connect: { id: v.id } },
      product: { connect: { id: v.productId } },
      bookQty: v.balance,
      actualQty: null as number | null,
      diffQty: null as number | null,
      remark: null as string | null,
      tenant: { connect: { id: tenantId } },
      ...auditCreateConnect(uid),
    }));

    const ic = await tx.inventoryCheck.create({
      data: {
        serviceCode,
        name,
        scope: JSON.stringify({ vendorIds: vendorIds ?? null, productIds: productIds ?? null }),
        snapshotAt,
        status: "DRAFT",
        remark,
        totalItems: variants.length,
        pendingItems: variants.length,
        items: { create: items },
        tenant: { connect: { id: tenantId } },
        ...auditCreateConnect(uid),
      } as never,
      include: { items: true },
    });

    return ic;
  });

  return new SuccessResponse(result, `盘点单创建成功：${serviceCode}`);
}

/** GET /inventoryCheck：盘点单列表 */
export async function getInventoryChecks(
  db: TenantPrismaClient,
  query: InventoryCheckQuery,
) {
  const { pagination, limit = 10, page = 1, status, name } = query;
  const paginate = pagination !== 0;
  const { skip, take } = getPaginationValues({ limit, page });

  const where: Prisma.InventoryCheckWhereInput = { deletedAt: null };
  if (status) where.status = status;
  if (name?.trim()) where.name = { contains: name.trim() };

  const [total, list] = await Promise.all([
    db.inventoryCheck.count({ where }),
    db.inventoryCheck.findMany({
      where,
      ...(paginate ? { skip, take } : {}),
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return new SuccessResponse(
    { list, total },
    "盘点单列表获取成功",
  );
}

/** GET /inventoryCheck/:id：盘点单详情（含 items） */
export async function getInventoryCheckById(
  db: TenantPrismaClient,
  id: number,
) {
  const record = await db.inventoryCheck.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: [{ product: { name: "asc" } }, { variantId: "asc" }],
        include: {
          product: { select: { name: true, id: true } },
          variant: {
            select: {
              id: true,
              productVariantJoinAttrs: {
                include: { attr: { select: { id: true, name: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!record) {
    return new ErrorResponse(errorCode.NOT_FOUND, "盘点单不存在");
  }
  return new SuccessResponse(record, "盘点单详情获取成功");
}

/**
 * PATCH /inventoryCheck/:id/start：DRAFT → COUNTING
 * 开始清点：一旦进入 COUNTING，盘点范围/快照不可修改
 */
export async function startInventoryCheck(
  db: TenantPrismaClient,
  user: AuthUser,
  id: number,
) {
  const uid = user.userId;

  const record = await db.inventoryCheck.findUnique({ where: { id } });
  if (!record) {
    return new ErrorResponse(errorCode.NOT_FOUND, "盘点单不存在");
  }
  if (record.status !== "DRAFT") {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, `当前状态 ${record.status} 不可开始清点`);
  }

  const updated = await db.inventoryCheck.update({
    where: { id },
    data: { status: "COUNTING", ...auditUpdateConnect(uid) },
  });
  return new SuccessResponse(updated, "盘点已开始");
}

/**
 * PUT /inventoryCheck/:id/items：批量录入实盘数
 * - 支持 COUNTING 状态
 * - 每个 item 后端自动算 diffQty
 * - 批量更新后重算汇总指标
 * - 所有 item.actualQty 非 null 时自动转 REVIEWING
 */
export async function updateInventoryCheckItems(
  db: TenantPrismaClient,
  user: AuthUser,
  id: number,
  body: InventoryCheckItemsBody,
) {
  const uid = user.userId;
  const { items } = body;

  const record = await db.inventoryCheck.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!record) {
    return new ErrorResponse(errorCode.NOT_FOUND, "盘点单不存在");
  }
  if (record.status !== "COUNTING") {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, `当前状态 ${record.status} 不可录入实盘数`);
  }

  // 校验 variantId 都属于这个盘点单
  const knownVariantIds = new Set(record.items.map((i) => i.variantId));
  const unknown = items.filter((i) => !knownVariantIds.has(i.variantId));
  if (unknown.length > 0) {
    throw new HttpError(
      400,
      errorCode.VALIDATION_ERROR,
      `以下 variantId 不属于本盘点单：${unknown.map((i) => i.variantId).join(",")}`,
    );
  }

  // 构建 InventoryCheckItem 的 diffQty 映射
  const bookQtyMap = new Map(record.items.map((i) => [i.variantId, i.bookQty]));

  await db.$transaction(async (tx) => {
    // 批量更新 item
    for (const line of items) {
      const bookQty = bookQtyMap.get(line.variantId)!;
      const diffQty = line.actualQty - bookQty;
      await tx.inventoryCheckItem.update({
        where: {
          inventoryCheckId_variantId: { inventoryCheckId: id, variantId: line.variantId },
        },
        data: {
          actualQty: line.actualQty,
          diffQty,
          remark: line.remark ?? undefined,
          ...auditUpdateConnect(uid),
        },
      });
    }

    // 重算汇总指标
    const refreshed = await tx.inventoryCheckItem.findMany({
      where: { inventoryCheckId: id },
      select: { actualQty: true, diffQty: true },
    });

    let pending = 0, matched = 0, surplus = 0, loss = 0, surplusQty = 0, lossQty = 0;
    for (const it of refreshed) {
      if (it.actualQty == null) {
        pending++;
      } else {
        if (it.diffQty === 0) matched++;
        else if (it.diffQty! > 0) { surplus++; surplusQty += it.diffQty!; }
        else { loss++; lossQty += -it.diffQty!; }
      }
    }

    // 自动转 REVIEWING（所有 item 都点完了）
    const newStatus = pending === 0 ? "REVIEWING" : "COUNTING";

    await tx.inventoryCheck.update({
      where: { id },
      data: {
        pendingItems: pending,
        matchedItems: matched,
        surplusItems: surplus,
        lossItems: loss,
        surplusQty,
        lossQty,
        status: newStatus,
        ...auditUpdateConnect(uid),
      },
    });
  });

  return new SuccessResponse(null, `实盘数更新成功`);
}

/**
 * PATCH /inventoryCheck/:id/complete：过账，把 diffQty 落实到 ProductVariant.balance
 * 硬校验：所有 item.actualQty 必须非 null
 */
export async function completeInventoryCheck(
  db: TenantPrismaClient,
  user: AuthUser,
  id: number,
) {
  const uid = user.userId;

  const record = await db.inventoryCheck.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!record) {
    return new ErrorResponse(errorCode.NOT_FOUND, "盘点单不存在");
  }
  if (record.status !== "REVIEWING" && record.status !== "COUNTING") {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, `当前状态 ${record.status} 不可过账`);
  }

  // 硬校验：所有 item.actualQty 必须非 null
  const nullCount = record.items.filter((i) => i.actualQty == null).length;
  if (nullCount > 0) {
    return new ErrorResponse(
      errorCode.VALIDATION_ERROR,
      `盘点单 ${record.serviceCode} 还有 ${nullCount} 条未清点，不能过账`,
    );
  }

  await db.$transaction(async (tx) => {
    // 锁定涉及的变体 + 产品行，防止并发
    const variantIds = [...new Set(record.items.map((i) => i.variantId))];
    const productIds = [...new Set(record.items.map((i) => i.productId))];

    if (variantIds.length > 0) {
      await tx.$queryRaw`SELECT id FROM ProductVariant WHERE id IN (${Prisma.join(variantIds)}) FOR UPDATE`;
    }
    if (productIds.length > 0) {
      await tx.$queryRaw`SELECT id FROM Product WHERE id IN (${Prisma.join(productIds)}) FOR UPDATE`;
    }

    // 调整每个变体的 balance（diffQty = actualQty - bookQty）
    for (const item of record.items) {
      const diff = item.actualQty! - item.bookQty;
      if (diff !== 0) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { balance: { increment: diff }, ...auditUpdateConnect(uid) },
        });
      }
    }

    // 重算 Product.balance = SUM(该产品所有变体的 balance)
    for (const pid of productIds) {
      const sum = await tx.productVariant.aggregate({
        where: { productId: pid },
        _sum: { balance: true },
      });
      await tx.product.update({
        where: { id: pid },
        data: { balance: sum._sum.balance ?? 0, ...auditUpdateConnect(uid) },
      });
    }

    await tx.inventoryCheck.update({
      where: { id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        ...auditUpdateConnect(uid),
      },
    });
  });

  const refreshed = await db.inventoryCheck.findUnique({ where: { id }, include: { items: true } });
  return new SuccessResponse(refreshed, `盘点单 ${record.serviceCode} 过账成功`);
}

/**
 * PATCH /inventoryCheck/:id/cancel：作废盘点单
 * 仅 DRAFT / COUNTING / REVIEWING 可作废
 */
export async function cancelInventoryCheck(
  db: TenantPrismaClient,
  user: AuthUser,
  id: number,
) {
  const uid = user.userId;

  const record = await db.inventoryCheck.findUnique({ where: { id } });
  if (!record) {
    return new ErrorResponse(errorCode.NOT_FOUND, "盘点单不存在");
  }
  if (record.status === "COMPLETED" || record.status === "CANCELLED") {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, `当前状态 ${record.status} 不可作废`);
  }

  await db.$transaction(async (tx) => {
    await tx.inventoryCheck.update({
      where: { id },
      data: { status: "CANCELLED", ...auditSoftDelete(uid) },
    });
  });

  return new SuccessResponse(null, `盘点单 ${record.serviceCode} 已作废`);
}
