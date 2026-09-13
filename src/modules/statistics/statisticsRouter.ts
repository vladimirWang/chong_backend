import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  getHotSalesHandler,
  getTopProductsByRevenueHandler,
  getTopProductsByVolumeHandler,
  getTopVendorsByRevenueHandler,
} from "./statisticsController";
import { dateRangeQuerySchema } from "./statisticsValidator";

/** 仪表盘统计路由（均需登录，按租户隔离） */
const statisticsRouter = new Hono()
  .get(
    "/hot-sales",
    zValidator("query", dateRangeQuerySchema),
    getHotSalesHandler,
  )
  .get(
    "/top-products-by-revenue",
    zValidator("query", dateRangeQuerySchema),
    getTopProductsByRevenueHandler,
  )
  .get(
    "/top-products-by-volume",
    zValidator("query", dateRangeQuerySchema),
    getTopProductsByVolumeHandler,
  )
  .get(
    "/top-vendors-by-revenue",
    zValidator("query", dateRangeQuerySchema),
    getTopVendorsByRevenueHandler,
  );

export { statisticsRouter };
