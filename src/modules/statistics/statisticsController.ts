import type { Context } from "hono";
import {
  getHotSales,
  getTopProductsByRevenue,
  getTopProductsByVolume,
  getTopVendorsByRevenue,
} from "./statisticsService";
import type { DateRangeQuery } from "./statisticsValidator";

/** GET /statistics/hot-sales */
export const getHotSalesHandler = async (c: Context) => {
  const query = c.req.valid("query" as never) as DateRangeQuery;
  return c.json(
    await getHotSales(c.get("tenantPrisma"), c.get("user")!, query),
  );
};

/** GET /statistics/top-products-by-revenue */
export const getTopProductsByRevenueHandler = async (c: Context) => {
  const query = c.req.valid("query" as never) as DateRangeQuery;
  return c.json(
    await getTopProductsByRevenue(
      c.get("tenantPrisma"),
      c.get("user")!,
      query,
    ),
  );
};

/** GET /statistics/top-products-by-volume */
export const getTopProductsByVolumeHandler = async (c: Context) => {
  const query = c.req.valid("query" as never) as DateRangeQuery;
  return c.json(
    await getTopProductsByVolume(
      c.get("tenantPrisma"),
      c.get("user")!,
      query,
    ),
  );
};

/** GET /statistics/top-vendors-by-revenue */
export const getTopVendorsByRevenueHandler = async (c: Context) => {
  const query = c.req.valid("query" as never) as DateRangeQuery;
  return c.json(
    await getTopVendorsByRevenue(
      c.get("tenantPrisma"),
      c.get("user")!,
      query,
    ),
  );
};
