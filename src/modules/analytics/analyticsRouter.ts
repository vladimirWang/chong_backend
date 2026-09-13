import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  getAnalyticsDailyTrendHandler,
  getAnalyticsOverviewHandler,
  getAnalyticsTopPathsHandler,
} from "./analyticsController";
import { analyticsRangeQuerySchema } from "./analyticsValidator";

/** 访问分析路由（需登录，按租户统计 access_log） */
const analyticsRouter = new Hono()
  .get(
    "/overview",
    zValidator("query", analyticsRangeQuerySchema),
    getAnalyticsOverviewHandler,
  )
  .get(
    "/daily-trend",
    zValidator("query", analyticsRangeQuerySchema),
    getAnalyticsDailyTrendHandler,
  )
  .get(
    "/top-paths",
    zValidator("query", analyticsRangeQuerySchema),
    getAnalyticsTopPathsHandler,
  );

export { analyticsRouter };
