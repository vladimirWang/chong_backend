import type { Context } from "hono";
import {
  getAnalyticsDailyTrend,
  getAnalyticsOverview,
  getAnalyticsTopPaths,
} from "./analyticsService";
import type { AnalyticsRangeQuery } from "./analyticsValidator";

/** GET /analytics/overview */
export const getAnalyticsOverviewHandler = async (c: Context) => {
  const query = c.req.valid("query" as never) as AnalyticsRangeQuery;
  return c.json(await getAnalyticsOverview(query));
};

/** GET /analytics/daily-trend */
export const getAnalyticsDailyTrendHandler = async (c: Context) => {
  const query = c.req.valid("query" as never) as AnalyticsRangeQuery;
  return c.json(await getAnalyticsDailyTrend(query));
};

/** GET /analytics/top-paths */
export const getAnalyticsTopPathsHandler = async (c: Context) => {
  const query = c.req.valid("query" as never) as AnalyticsRangeQuery;
  return c.json(await getAnalyticsTopPaths(query));
};
