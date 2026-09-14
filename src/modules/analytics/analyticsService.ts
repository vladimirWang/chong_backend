import { getClickhouse, ACCESS_LOG_TABLE } from "../../utils/clickhouse";
import { SuccessResponse } from "../../models/Response";
import type { AnalyticsRangeQuery } from "./analyticsValidator";

interface OverviewRow {
  pv: string | number;
  uv: string | number;
}
interface TrendRow {
  day: string;
  pv: string | number;
  uv: string | number;
}
interface TopPathRow {
  path: string;
  pv: string | number;
  avgDuration: string | number;
}

/** ClickHouse DateTime 字面量格式：'YYYY-MM-DD HH:MM:SS' */
function formatDateTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 解析查询区间；缺省近 7 天（与前端 RangePicker 默认值对齐） */
function resolveRange(query: AnalyticsRangeQuery) {
  const end = query.endDate ? new Date(query.endDate) : new Date();
  end.setHours(23, 59, 59, 999);
  const start = query.startDate ? new Date(query.startDate) : new Date();
  if (!query.startDate) start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

interface RangeParams {
  start: string;
  end: string;
}

async function queryCh<T>(
  sql: string,
  params: RangeParams,
): Promise<T[] | null> {
  const ch = getClickhouse();
  if (!ch) return null; // ClickHouse 未配置/不可用时降级为空数据
  const resultSet = await ch.query({
    query: sql,
    query_params: { ...params },
    format: "JSONEachRow",
  });
  // JSONEachRow：json<Row>() 返回 Row[]
  return resultSet.json<T>();
}

/** GET /analytics/overview：区间 PV/UV（UV = 去重登录用户数） */
export async function getAnalyticsOverview(
  query: AnalyticsRangeQuery,
) {
  const { start, end } = resolveRange(query);
  const rows = await queryCh<OverviewRow>(
    `
      SELECT count() AS pv,
             uniqExactIf(userId, userId IS NOT NULL) AS uv
      FROM ${ACCESS_LOG_TABLE}
      WHERE ts >= {start:String}
        AND ts <= {end:String}
    `,
    { start: formatDateTime(start), end: formatDateTime(end) },
  );

  const row = rows?.[0];
  return new SuccessResponse(
    { pv: Number(row?.pv ?? 0), uv: Number(row?.uv ?? 0) },
    "访问概览获取成功",
  );
}

/** GET /analytics/daily-trend：按日 PV/UV（补齐区间内无访问的日期） */
export async function getAnalyticsDailyTrend(
  query: AnalyticsRangeQuery,
) {
  const { start, end } = resolveRange(query);
  const rows = await queryCh<TrendRow>(
    `
      SELECT toDate(ts) AS day,
             count() AS pv,
             uniqExactIf(userId, userId IS NOT NULL) AS uv
      FROM ${ACCESS_LOG_TABLE}
      WHERE ts >= {start:String}
        AND ts <= {end:String}
      GROUP BY day
      ORDER BY day
    `,
    { start: formatDateTime(start), end: formatDateTime(end) },
  );

  const map = new Map(
    (rows ?? []).map((row) => [
      row.day,
      { pv: Number(row.pv), uv: Number(row.uv) },
    ]),
  );

  const trend: { day: string; pv: number; uv: number }[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = formatDate(cursor);
    trend.push({ day, pv: map.get(day)?.pv ?? 0, uv: map.get(day)?.uv ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return new SuccessResponse(trend, "访问趋势获取成功");
}

/** GET /analytics/top-paths：访问量 Top10 路径 + 平均耗时 */
export async function getAnalyticsTopPaths(
  query: AnalyticsRangeQuery,
) {
  const { start, end } = resolveRange(query);
  const rows = await queryCh<TopPathRow>(
    `
      SELECT path,
             count() AS pv,
             toUInt32(round(avg(duration))) AS avgDuration
      FROM ${ACCESS_LOG_TABLE}
      WHERE ts >= {start:String}
        AND ts <= {end:String}
      GROUP BY path
      ORDER BY pv DESC
      LIMIT 10
    `,
    { start: formatDateTime(start), end: formatDateTime(end) },
  );

  const result = (rows ?? []).map((row) => ({
    path: row.path,
    pv: Number(row.pv),
    avgDuration: Number(row.avgDuration),
  }));

  return new SuccessResponse(result, "热门路径获取成功");
}
