import type { Prisma } from "../../generated/prisma/client";
import type { TenantPrismaClient } from "../../utils/prisma";
import { SuccessResponse, ErrorResponse, errorCode } from "../../models/Response";
import { HttpError } from "../../models/HttpError";
import { getPaginationValues } from "../../utils/db";
import { auditCreateConnect, auditUpdateConnect } from "../../utils/auditUser";
import { normalizeSpecSkuIds, parseSpecSkuIds } from "../../utils/algo";
import { resolveVariant } from "../../utils/variant";
import { generateServiceCode } from "../../utils/common";
import { invalidateProductDetailCache } from "../product/productService";
import type { AuthUser } from "../../types/auth";
import type {
  AfterSalesQuery,
  ConfirmCustomerBody,
  ConfirmMerchantBody,
  CreateAfterSalesBody,
  StockOutOptionsQuery,
} from "./afterSalesValidator";

/**
 * 售后业务层（退货 / 换货 / 返修）
 *
 * 与出货单的关系使用「逻辑外键」：
 * - AfterSales.stockOutId → StockOut.id（仅保存 id，不建数据库外键）
 * - AfterSalesItem.stockOutItemId → ProductJoinStockOut.id（仅保存 id，不建数据库外键）
 * 所有存在性、归属关系、可售后数量均由本层手动校验。
 *
 * 接收方确认：
 * - RETURN：商家接收即完成（商品回库），支持部分退款 refundAmount
 * - EXCHANGE：商家接收 → MERCHANT_RECEIVED → 客户收到换后商品 → COMPLETED
 * - REPAIR：商家接收 → MERCHANT_RECEIVED → 客户收到修后商品 → COMPLETED
 *
 * 库存：
 * - RETURN 商家接收时 ProductVariant.balance / Product.balance 同步增加（退货回库）
 * - EXCHANGE / REPAIR 为原物返回再寄出，净库存不变，不做库存变更
 */

const TYPE_PREFIX: Record<string, string> = {
  RETURN: "TH",
  EXCHANGE: "HH",
  REPAIR: "FX",
};

const TYPE_REDIS_KEY: Record<string, string> = {
  RETURN: "returnCode",
  EXCHANGE: "exchangeCode",
  REPAIR: "repairCode",
};

const VARIANT_KEY = (productId: number, specSkuIds: string) =>
  `${productId}-${specSkuIds}`;

/** GET /afterSales：分页列表 */
export async function getAfterSales(
  db: TenantPrismaClient,
  query: AfterSalesQuery,
) {
  const {
    pagination: paginationNum = 1,
    limit = 10,
    page = 1,
    type,
    status,
    serviceCode,
    stockOutServiceCode,
  } = query;
  const paginate = paginationNum !== 0;
  const { skip, take } = getPaginationValues({ limit, page });

  const where: Prisma.AfterSalesWhereInput = { deletedAt: null };
  if (type) where.type = type;
  if (status) where.status = status;
  if (serviceCode?.trim()) {
    where.serviceCode = { contains: serviceCode.trim() };
  }
  if (stockOutServiceCode?.trim()) {
    where.stockOutServiceCode = { contains: stockOutServiceCode.trim() };
  }

  const [total, list] = await Promise.all([
    db.afterSales.count({ where }),
    db.afterSales.findMany({
      where,
      ...(paginate ? { skip, take } : {}),
      orderBy: { updatedAt: "desc" },
      include: {
        items: {
          where: { deletedAt: null },
          include: { product: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  return new SuccessResponse({ list, total }, "售后单列表获取成功");
}

/** GET /afterSales/:id：详情（补充逻辑外键指向的出货单信息） */
export async function getAfterSalesById(db: TenantPrismaClient, id: number) {
  const record = await db.afterSales.findUnique({
    where: { id },
    include: {
      items: {
        where: { deletedAt: null },
        include: { product: { select: { id: true, name: true } } },
      },
    },
  });
  if (!record) {
    return new ErrorResponse(errorCode.NOT_FOUND, "售后单不存在");
  }

  // 逻辑外键：手动关联出货单，供前端展示
  const stockOut = await db.stockOut.findUnique({
    where: { id: record.stockOutId },
    select: {
      id: true,
      serviceCode: true,
      status: true,
      platformId: true,
      platformOrderNo: true,
      clientId: true,
      createdAt: true,
    },
  });

  return new SuccessResponse({ ...record, stockOut }, "售后单详情获取成功");
}

/** 出货单 + 明细行，逻辑外键存在性校验的前置数据 */
async function loadStockOutWithLines(
  db: TenantPrismaClient,
  stockOutId: number,
) {
  const stockOut = await db.stockOut.findUnique({
    where: { id: stockOutId },
    include: {
      productJoinStockOut: {
        where: { deletedAt: null },
        include: { product: { select: { id: true, name: true } } },
      },
    },
  });
  if (!stockOut || stockOut.deletedAt) {
    throw new HttpError(
      400,
      errorCode.VALIDATION_ERROR,
      `关联的出货单不存在: ${stockOutId}`,
    );
  }
  if (stockOut.status !== "COMPLETED") {
    throw new HttpError(
      400,
      errorCode.VALIDATION_ERROR,
      `出货单 ${stockOut.serviceCode} 未确认完成，不能创建售后单`,
    );
  }
  return stockOut;
}

/** 查询某出货单下各明细行已被售后占用的数量（分类型统计） */
async function getConsumedCountByStockOut(
  db: TenantPrismaClient,
  tenantId: number,
  stockOutId: number,
) {
  const consumedItems = await db.afterSalesItem.findMany({
    where: {
      tenantId,
      deletedAt: null,
      afterSales: {
        tenantId,
        stockOutId,
        status: { not: "CANCELLED" },
        deletedAt: null,
      },
    },
    select: {
      stockOutItemId: true,
      count: true,
      afterSales: { select: { type: true } },
    },
  });

  const map = new Map<
    number,
    { returned: number; exchanged: number; repaired: number }
  >();
  for (const item of consumedItems) {
    const stat = map.get(item.stockOutItemId) ?? {
      returned: 0,
      exchanged: 0,
      repaired: 0,
    };
    if (item.afterSales.type === "RETURN") stat.returned += item.count;
    else if (item.afterSales.type === "EXCHANGE") stat.exchanged += item.count;
    else stat.repaired += item.count;
    map.set(item.stockOutItemId, stat);
  }
  return map;
}

/** POST /afterSales：创建售后单（不改变库存，接收确认时才产生库存动作） */
export async function createAfterSales(
  db: TenantPrismaClient,
  user: AuthUser,
  body: CreateAfterSalesBody,
) {
  const uid = user.userId;
  const tenantId = user.tenantId!;
  const { stockOutId, type, items, reason, remark, docs } = body;

  const stockOut = await loadStockOutWithLines(db, stockOutId);
  const lineMap = new Map(
    stockOut.productJoinStockOut.map((line) => [line.id, line]),
  );

  // 逻辑外键归属校验：每一条明细都必须属于该出货单
  const seen = new Set<number>();
  for (const item of items) {
    if (seen.has(item.stockOutItemId)) {
      throw new HttpError(
        400,
        errorCode.VALIDATION_ERROR,
        `明细行重复: ${item.stockOutItemId}`,
      );
    }
    seen.add(item.stockOutItemId);
    if (!lineMap.has(item.stockOutItemId)) {
      throw new HttpError(
        400,
        errorCode.VALIDATION_ERROR,
        `出货明细行不存在或不属于该出货单: ${item.stockOutItemId}`,
      );
    }
  }

  // 可售后数量校验：出货数量 - 已占用（未取消的售后单）
  const consumedMap = await getConsumedCountByStockOut(
    db,
    tenantId,
    stockOutId,
  );
  const normalizedLines = items.map((item) => {
    const outLine = lineMap.get(item.stockOutItemId)!;
    const stat = consumedMap.get(item.stockOutItemId) ?? {
      returned: 0,
      exchanged: 0,
      repaired: 0,
    };
    const remaining =
      outLine.count - stat.returned - stat.exchanged - stat.repaired;
    if (item.count > remaining) {
      throw new HttpError(
        400,
        errorCode.VALIDATION_ERROR,
        `产品 ${outLine.product?.name ?? outLine.productId} 可售后数量不足，剩余 ${Math.max(remaining, 0)}`,
      );
    }
    return {
      stockOutItemId: outLine.id,
      productId: outLine.productId,
      vendorId: outLine.vendorId,
      specSkuIds: normalizeSpecSkuIds(outLine.specSkuIds),
      price: outLine.price,
      count: item.count,
      repairFee: type === "REPAIR" ? (item.repairFee ?? 0) : 0,
      remark: item.remark,
    };
  });

  const totalCount = normalizedLines.reduce((a, c) => a + c.count, 0);
  const totalPrice =
    type === "RETURN"
      ? normalizedLines.reduce((a, c) => a + c.price * c.count, 0)
      : type === "REPAIR"
        ? normalizedLines.reduce((a, c) => a + c.repairFee * c.count, 0)
        : 0;

  const { serviceCode } = await generateServiceCode(
    TYPE_PREFIX[type],
    TYPE_REDIS_KEY[type],
  );

  const created = await db.afterSales.create({
    data: {
      tenant: { connect: { id: tenantId } },
      serviceCode,
      type,
      status: "PENDING",
      // 逻辑外键：仅保存出货单 id 与单号快照
      stockOutId,
      stockOutServiceCode: stockOut.serviceCode,
      clientId: stockOut.clientId ?? undefined,
      reason,
      remark,
      docs: docs as never,
      totalCount,
      totalPrice,
      ...auditCreateConnect(uid),
      items: {
        create: normalizedLines.map((line) => ({
          tenant: { connect: { id: tenantId } },
          stockOutItemId: line.stockOutItemId,
          product: { connect: { id: line.productId } },
          vendorId: line.vendorId,
          specSkuIds: line.specSkuIds,
          price: line.price,
          count: line.count,
          repairFee: line.repairFee,
          remark: line.remark,
          ...auditCreateConnect(uid),
        })),
      },
    } as never,
    include: {
      items: {
        include: { product: { select: { id: true, name: true } } },
      },
    },
  });

  return new SuccessResponse(
    created,
    `售后单创建成功，单号: ${serviceCode}`,
  );
}

/** 规格组合 → 变体（集合相等解析），变体不存在说明该规格已无库存记录 */
async function resolveVariantMapForItems(
  db: TenantPrismaClient,
  items: { productId: number; specSkuIds: string }[],
) {
  const variantMap = new Map<string, number>();
  for (const item of items) {
    const variant = await resolveVariant(
      db,
      item.productId,
      parseSpecSkuIds(item.specSkuIds),
    );
    if (!variant) {
      throw new HttpError(
        400,
        errorCode.VALIDATION_ERROR,
        `该规格无库存: ${item.productId}-${item.specSkuIds}`,
      );
    }
    variantMap.set(
      VARIANT_KEY(item.productId, item.specSkuIds),
      variant.id,
    );
  }
  return variantMap;
}

/**
 * PATCH /afterSales/:id/confirmMerchant：商家接收确认
 * - RETURN：商品回库 + 记录退款金额（默认全额，可部分退款），状态直接 COMPLETED
 * - EXCHANGE/REPAIR：仅确认时间点，状态转为 MERCHANT_RECEIVED
 */
export async function confirmMerchantReceipt(
  db: TenantPrismaClient,
  user: AuthUser,
  id: number,
  body: ConfirmMerchantBody,
) {
  const uid = user.userId;
  const record = await db.afterSales.findUnique({
    where: { id },
    include: { items: { where: { deletedAt: null } } },
  });
  if (!record) {
    return new ErrorResponse(errorCode.NOT_FOUND, "售后单不存在");
  }
  if (record.status !== "PENDING") {
    throw new HttpError(
      400,
      errorCode.VALIDATION_ERROR,
      `当前状态 ${record.status} 不可确认商家接收`,
    );
  }
  if (record.items.length === 0) {
    throw new HttpError(
      400,
      errorCode.VALIDATION_ERROR,
      "售后单没有明细，不能确认",
    );
  }

  const receivedAt = body.receivedAt ?? new Date();

  // 换货/返修：仅推进到「商家已接收」
  if (record.type !== "RETURN") {
    const updated = await db.afterSales.update({
      where: { id },
      data: {
        status: "MERCHANT_RECEIVED",
        merchantReceivedAt: receivedAt,
        ...auditUpdateConnect(uid),
      },
      include: {
        items: {
          where: { deletedAt: null },
          include: { product: { select: { id: true, name: true } } },
        },
      },
    });
    return new SuccessResponse(updated, "商家接收确认成功，等待客户收货确认");
  }

  // 退货：部分退款金额校验（默认全额）
  const refundAmount = body.refundAmount ?? record.totalPrice;
  if (refundAmount < 0 || refundAmount > record.totalPrice) {
    throw new HttpError(
      400,
      errorCode.VALIDATION_ERROR,
      `退款金额必须在 0 ~ ${record.totalPrice} 之间`,
    );
  }

  const variantMap = await resolveVariantMapForItems(db, record.items);
  const productCountMap = new Map<number, number>();
  for (const item of record.items) {
    productCountMap.set(
      item.productId,
      (productCountMap.get(item.productId) ?? 0) + item.count,
    );
  }

  await db.$transaction([
    ...record.items.map((item) =>
      db.productVariant.update({
        where: {
          id: variantMap.get(
            VARIANT_KEY(item.productId, item.specSkuIds),
          )!,
        },
        data: {
          balance: { increment: item.count },
          ...auditUpdateConnect(uid),
        },
      }),
    ),
    ...[...productCountMap.entries()].map(([productId, count]) =>
      db.product.update({
        where: { id: productId },
        data: {
          balance: { increment: count },
          ...auditUpdateConnect(uid),
        },
      }),
    ),
    db.afterSales.update({
      where: { id },
      data: {
        status: "COMPLETED",
        merchantReceivedAt: receivedAt,
        completedAt: receivedAt,
        refundAmount,
        ...auditUpdateConnect(uid),
      },
    }),
  ]);

  await invalidateProductDetailCache(user.tenantId!, [
    ...productCountMap.keys(),
  ]);

  const refreshed = await db.afterSales.findUnique({
    where: { id },
    include: {
      items: {
        where: { deletedAt: null },
        include: { product: { select: { id: true, name: true } } },
      },
    },
  });
  return new SuccessResponse(refreshed, `售后单 ${record.serviceCode} 已完成（退货入库）`);
}

/**
 * PATCH /afterSales/:id/confirmCustomer：客户收货确认
 * 仅换货/返修，且必须在商家已接收之后
 */
export async function confirmCustomerReceipt(
  db: TenantPrismaClient,
  user: AuthUser,
  id: number,
  body: ConfirmCustomerBody,
) {
  const uid = user.userId;
  const record = await db.afterSales.findUnique({ where: { id } });
  if (!record) {
    return new ErrorResponse(errorCode.NOT_FOUND, "售后单不存在");
  }
  if (record.type === "RETURN") {
    throw new HttpError(
      400,
      errorCode.VALIDATION_ERROR,
      "退货单以商家接收为完成节点，无需客户收货确认",
    );
  }
  if (record.status !== "MERCHANT_RECEIVED") {
    throw new HttpError(
      400,
      errorCode.VALIDATION_ERROR,
      `当前状态 ${record.status} 不可进行客户收货确认`,
    );
  }

  const receivedAt = body.receivedAt ?? new Date();
  const updated = await db.afterSales.update({
    where: { id },
    data: {
      status: "COMPLETED",
      customerReceivedAt: receivedAt,
      completedAt: receivedAt,
      ...auditUpdateConnect(uid),
    },
    include: {
      items: {
        where: { deletedAt: null },
        include: { product: { select: { id: true, name: true } } },
      },
    },
  });
  return new SuccessResponse(updated, `售后单 ${record.serviceCode} 已完成`);
}

/** PATCH /afterSales/:id/cancel：取消（仅待处理可取消） */
export async function cancelAfterSales(
  db: TenantPrismaClient,
  user: AuthUser,
  id: number,
) {
  const record = await db.afterSales.findUnique({ where: { id } });
  if (!record) {
    return new ErrorResponse(errorCode.NOT_FOUND, "售后单不存在");
  }
  if (record.status !== "PENDING") {
    throw new HttpError(
      400,
      errorCode.VALIDATION_ERROR,
      `当前状态 ${record.status} 不可取消`,
    );
  }

  await db.afterSales.update({
    where: { id },
    data: { status: "CANCELLED", ...auditUpdateConnect(user.userId) },
  });
  return new SuccessResponse(null, `售后单 ${record.serviceCode} 已取消`);
}

/** GET /afterSales/stockOutOptions：可关联的已完成出货单搜索 */
export async function getStockOutOptions(
  db: TenantPrismaClient,
  query: StockOutOptionsQuery,
) {
  const keyword = query.keyword?.trim();
  const where: Prisma.StockOutWhereInput = {
    deletedAt: null,
    status: "COMPLETED",
  };
  if (keyword) {
    where.OR = [
      { serviceCode: { contains: keyword } },
      { platformOrderNo: { contains: keyword } },
    ];
  }

  const list = await db.stockOut.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      serviceCode: true,
      platformOrderNo: true,
      clientId: true,
      totalPrice: true,
      createdAt: true,
      completedAt: true,
      _count: { select: { productJoinStockOut: true } },
    },
  });

  return new SuccessResponse({ list }, "可关联出货单获取成功");
}

/** GET /afterSales/stockOut/:stockOutId/available：出货明细可售后数量 */
export async function getStockOutAvailableLines(
  db: TenantPrismaClient,
  tenantId: number,
  stockOutId: number,
) {
  const stockOut = await loadStockOutWithLines(db, stockOutId);
  const consumedMap = await getConsumedCountByStockOut(
    db,
    tenantId,
    stockOutId,
  );

  // 规格组合 → 展示文案（属性名拼接）
  const productIds = [
    ...new Set(stockOut.productJoinStockOut.map((line) => line.productId)),
  ];
  const variants = productIds.length
    ? await db.productVariant.findMany({
        where: { productId: { in: productIds }, deletedAt: null },
        include: {
          productVariantJoinAttrs: {
            include: { attr: { select: { id: true, name: true } } },
          },
        },
      })
    : [];
  const specTextMap = new Map<string, string>();
  for (const variant of variants) {
    const key = VARIANT_KEY(
      variant.productId,
      normalizeSpecSkuIds(
        variant.productVariantJoinAttrs.map((item) => item.attrId).join(","),
      ),
    );
    specTextMap.set(
      key,
      variant.productVariantJoinAttrs
        .map((item) => item.attr.name)
        .join(" / "),
    );
  }

  const lines = stockOut.productJoinStockOut.map((line) => {
    const specSkuIds = normalizeSpecSkuIds(line.specSkuIds);
    const stat = consumedMap.get(line.id) ?? {
      returned: 0,
      exchanged: 0,
      repaired: 0,
    };
    const consumed = stat.returned + stat.exchanged + stat.repaired;
    return {
      stockOutItemId: line.id,
      productId: line.productId,
      productName: line.product?.name ?? "",
      specSkuIds,
      specText:
        specTextMap.get(VARIANT_KEY(line.productId, specSkuIds)) ||
        (specSkuIds ? specSkuIds : "默认规格"),
      price: line.price,
      vendorId: line.vendorId,
      shippedCount: line.count,
      returnedCount: stat.returned,
      exchangedCount: stat.exchanged,
      repairedCount: stat.repaired,
      remaining: Math.max(line.count - consumed, 0),
    };
  });

  return new SuccessResponse(
    {
      stockOut: {
        id: stockOut.id,
        serviceCode: stockOut.serviceCode,
        status: stockOut.status,
        clientId: stockOut.clientId,
        platformId: stockOut.platformId,
        platformOrderNo: stockOut.platformOrderNo,
        createdAt: stockOut.createdAt,
        completedAt: stockOut.completedAt,
      },
      lines,
    },
    "出货单可售后明细获取成功",
  );
}
