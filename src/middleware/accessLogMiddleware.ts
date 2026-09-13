import type { Context, Next } from "hono";
import { ACCESS_LOG_TABLE, getClickhouse } from "../utils/clickhouse";

/** ClickHouse DateTime 字面量格式：'YYYY-MM-DD HH:MM:SS' */
function formatDateTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 访问日志中间件（移植自 repo_backend accessLogPlugin）
 * 每个请求响应后向 ClickHouse access_log 写一行：
 * ts/path/method/status/duration/userId/tenantId
 * 写入失败只告警，绝不影响业务响应。
 */
export async function accessLogMiddleware(c: Context, next: Next) {
  const start = performance.now();
  await next();

  const ch = getClickhouse();
  if (!ch) return;

  const user = c.get("user");
  const row = {
    ts: formatDateTime(new Date()),
    path: c.req.path,
    method: c.req.method,
    status: c.res.status,
    duration: Math.round(performance.now() - start),
    userId: user?.userId ?? null,
    tenantId: user?.tenantId ?? null,
  };

  // 不 await：日志落库不阻塞/拖慢响应
  ch.insert({ table: ACCESS_LOG_TABLE, values: [row], format: "JSONEachRow" })
    .catch((err) => {
      console.warn("[accessLog] 写入 ClickHouse 失败:", err);
    });
}
