// ╔══════════════════════════════════════════════════════════════╗
// ║  ClickHouse 已暂时禁用                                          ║
// ║  恢复方法：删除下方 stub，取消注释原始实现，确保 @clickhouse/   ║
// ║  client 已安装（package.json）且 .env 配置 CLICKHOUSE_URL      ║
// ╚══════════════════════════════════════════════════════════════╝

// ──────── 原始实现（已注释）────────
// import { createClient, type ClickHouseClient } from "@clickhouse/client";
//
// const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL;
// const ACCESS_LOG_TABLE = "access_log";
//
// let client: ClickHouseClient | null = null;
// let initialized = false;
//
// /** 获取 ClickHouse 单例（未配置时返回 null，不抛异常） */
// export function getClickhouse(): ClickHouseClient | null {
//   if (!CLICKHOUSE_URL) {
//     if (!initialized) {
//       console.warn("CLICKHOUSE_URL 未配置，访问量统计将跳过");
//       initialized = true;
//     }
//     return null;
//   }
//   if (!client) {
//     client = createClient({ url: CLICKHOUSE_URL });
//   }
//   return client;
// }
//
// /** 启动时自动建表（幂等） */
// export async function initClickhouse(): Promise<void> {
//   const ch = getClickhouse();
//   if (!ch) return;
//
//   try {
//     await ch.command({ query: "CREATE DATABASE IF NOT EXISTS default" });
//
//     await ch.command({
//       query: `
//         CREATE TABLE IF NOT EXISTS ${ACCESS_LOG_TABLE}
//         (
//           ts       DateTime DEFAULT now(),
//           path     String,
//           method   String,
//           status   UInt16,
//           duration UInt32,
//           userId   Nullable(UInt32),
//           tenantId Nullable(UInt32)
//         )
//         ENGINE = MergeTree()
//         PARTITION BY toDate(ts)
//         ORDER BY (ts, path)
//       `,
//     });
//
//     initialized = true;
//     console.log(`ClickHouse 已连接 ${CLICKHOUSE_URL}，表 ${ACCESS_LOG_TABLE} 就绪`);
//   } catch (err) {
//     console.warn("ClickHouse 连接/建表失败，访问量统计将跳过（不影响主流程）", err);
//   }
// }
//
// export { ACCESS_LOG_TABLE };
// ──────── 原始实现结束 ────────

// ──────── Stub：保持导出签名，调用方（accessLogMiddleware / analyticsService / index.ts）自动降级 ────────
// getClickhouse 返回 any（实际为 null），调用方 `if (!ch) return` 守卫会拦截，
// insert/query 永不执行；恢复原始实现后类型即恢复为 ClickHouseClient | null。
export const ACCESS_LOG_TABLE = "access_log";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getClickhouse(): any {
  return null;
}

export async function initClickhouse(): Promise<void> {}
