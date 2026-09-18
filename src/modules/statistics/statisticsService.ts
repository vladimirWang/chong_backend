import { Prisma } from "@prisma/client";
import { SuccessResponse } from "../../models/Response";
import type { TenantPrismaClient } from "../../utils/prisma";
import type { AuthUser } from "../../types/auth";
import type { DateRangeQuery } from "./statisticsValidator";

interface AggregateRow {
  id: number;
  value: Prisma.Decimal | number | bigint | null;
}

/** 把前端 'YYYY-MM-DD' 统一为当天 [00:00:00.000, 23:59:59.999]（与老实现一致） */
function getRangeStartEnd(query: DateRangeQuery) {
  const start = new Date(query.startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(query.endDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * 已完成出货明细的公共聚合条件。
 * 注意：$queryRaw 不经过 prisma 扩展，租户隔离与软删除过滤必须显式书写。
 */
function buildJoinWhere(
  tenantId: number,
  start: Date,
  end: Date,
  groupColumn: "productId" | "vendorId",
) {
  const metricExpr =
    groupColumn === "productId"
      ? Prisma.sql`pjso.productId`
      : Prisma.sql`pjso.vendorId`;
  return {
    select: Prisma.sql`SELECT ${metricExpr} AS id`,
    from: Prisma.sql`
      FROM ProductJoinStockOut pjso
      INNER JOIN StockOut so ON pjso.stockOutId = so.id
      WHERE pjso.tenantId = ${tenantId}
        AND so.tenantId = ${tenantId}
        AND pjso.deletedAt IS NULL
        AND so.deletedAt IS NULL
        AND so.status = 'COMPLETED'
        AND so.completedAt >= ${start}
        AND so.completedAt <= ${end}
    `,
  };
}

/** GET /statistics/hot-sales：热销商品（按销售额 Top10，带商品详情） */
export async function getHotSales(
  db: TenantPrismaClient,
  user: AuthUser,
  query: DateRangeQuery,
) {
  // 平台 admin（tenantId 为空，authMiddleware 也不会创建 tenantPrisma）没有租户口径数据，直接返回空列表
  const tenantId = user.tenantId;
  if (tenantId == null) {
    return new SuccessResponse([], "热销商品获取成功");
  }
  const { start, end } = getRangeStartEnd(query);
  const { select, from } = buildJoinWhere(tenantId, start, end, "productId");

  const rows = await db.$queryRaw<AggregateRow[]>`
    ${select},
    SUM(pjso.price * pjso.count) AS value
    ${from}
    GROUP BY pjso.productId
    ORDER BY value DESC
    LIMIT 10
  `;

  const productIds = rows.map((row) => row.id);
  // findMany 经扩展自动追加 tenantId + deletedAt IS NULL
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    include: { vendor: true },
  });

  const result = rows
    .map((row) => {
      const product = products.find((p) => p.id === row.id);
      if (!product) return null; // 商品已（跨租户不可见/软删）时剔除
      return {
        productId: row.id,
        totalAmount: Number(row.value ?? 0),
        product,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return new SuccessResponse(result, "热销商品获取成功");
}

/** GET /statistics/top-products-by-revenue：销售额最高的 10 个产品 */
export async function getTopProductsByRevenue(
  db: TenantPrismaClient,
  user: AuthUser,
  query: DateRangeQuery,
) {
  // 平台 admin 无租户口径数据（tenantPrisma 未创建），返回空列表
  const tenantId = user.tenantId;
  if (tenantId == null) {
    return new SuccessResponse([], "销售额最高的产品获取成功");
  }
  const { start, end } = getRangeStartEnd(query);
  const { select, from } = buildJoinWhere(tenantId, start, end, "productId");

  const rows = await db.$queryRaw<AggregateRow[]>`
    ${select},
    SUM(pjso.price * pjso.count) AS value
    ${from}
    GROUP BY pjso.productId
    ORDER BY value DESC
    LIMIT 10
  `;

  const products = await db.product.findMany({
    where: { id: { in: rows.map((row) => row.id) } },
  });

  const result = rows
    .map((row) => {
      const product = products.find((p) => p.id === row.id);
      if (!product) return null;
      return {
        productId: row.id,
        productName: product.name,
        totalRevenue: Number(row.value ?? 0),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return new SuccessResponse(result, "销售额最高的产品获取成功");
}

/** GET /statistics/top-products-by-volume：销量最好的 10 个产品 */
export async function getTopProductsByVolume(
  db: TenantPrismaClient,
  user: AuthUser,
  query: DateRangeQuery,
) {
  // 平台 admin 无租户口径数据（tenantPrisma 未创建），返回空列表
  const tenantId = user.tenantId;
  if (tenantId == null) {
    return new SuccessResponse([], "销量最好的产品获取成功");
  }
  const { start, end } = getRangeStartEnd(query);
  const { select, from } = buildJoinWhere(tenantId, start, end, "productId");

  const rows = await db.$queryRaw<AggregateRow[]>`
    ${select},
    SUM(pjso.count) AS value
    ${from}
    GROUP BY pjso.productId
    ORDER BY value DESC
    LIMIT 10
  `;

  const products = await db.product.findMany({
    where: { id: { in: rows.map((row) => row.id) } },
  });

  const result = rows
    .map((row) => {
      const product = products.find((p) => p.id === row.id);
      if (!product) return null;
      return {
        productId: row.id,
        productName: product.name,
        totalCount: Number(row.value ?? 0),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return new SuccessResponse(result, "销量最好的产品获取成功");
}

/** GET /statistics/top-vendors-by-revenue：销售额最高的品牌（Top10） */
export async function getTopVendorsByRevenue(
  db: TenantPrismaClient,
  user: AuthUser,
  query: DateRangeQuery,
) {
  // 平台 admin 无租户口径数据（tenantPrisma 未创建），返回空列表
  const tenantId = user.tenantId;
  if (tenantId == null) {
    return new SuccessResponse([], "销售额最高的品牌获取成功");
  }
  const { start, end } = getRangeStartEnd(query);
  const { select, from } = buildJoinWhere(tenantId, start, end, "vendorId");

  const rows = await db.$queryRaw<AggregateRow[]>`
    ${select},
    SUM(pjso.price * pjso.count) AS value
    ${from}
    GROUP BY pjso.vendorId
    ORDER BY value DESC
    LIMIT 10
  `;

  const vendors = await db.vendor.findMany({
    where: { id: { in: rows.map((row) => row.id) } },
  });

  const result = rows
    .map((row) => {
      const vendor = vendors.find((v) => v.id === row.id);
      if (!vendor) return null;
      return {
        vendorId: row.id,
        vendorName: vendor.name,
        totalRevenue: Number(row.value ?? 0),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return new SuccessResponse(result, "销售额最高的品牌获取成功");
}
