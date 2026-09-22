import winston from "winston";
import "winston-daily-rotate-file";
import path from "node:path";

/**
 * 全局日志器
 * - NODE_ENV=production：按日切分写入文件（由 logDir 决定位置）
 *   * app-YYYY-MM-DD.log   info 及以上全量日志
 *   * error-YYYY-MM-DD.log 仅 error（便于快速排障）
 * - NODE_ENV=development（默认）：彩色输出到 console，级别 debug
 *
 * 文件为 JSON 行格式，便于 docker cp 后用 jq/日志平台解析；
 * 旧日志自动 gzip，保留 14 天，单文件超过 20MB 也会滚动。
 */

const isProduction = process.env.NODE_ENV === "production";
const defaultLogDir = path.resolve(process.cwd(), "logs");

console.log("process.env.NODE_ENV:", process.env.NODE_ENV);
console.log("process.env.LOG_DIR:", process.env.LOG_DIR);
console.log("isProduction:", isProduction);
console.log("defaultLogDir:", defaultLogDir);

const LOG_LEVEL = process.env.LOG_LEVEL || "debug";
const DEFAULT_LOG_DIR =
  process.env.SERVER_LOG_DIR ||
  (isProduction ? "/var/log/galleryrepo" : defaultLogDir);

console.log("DEFAULT_LOG_DIR:", DEFAULT_LOG_DIR);

// 文件格式：JSON 行，带时间戳/级别/模块/堆栈
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// 控制台格式：彩色、可读
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const label = meta.module ? `[${meta.module}]` : "";
    delete meta.module;
    const rest = Object.keys(meta).length
      ? " " + JSON.stringify(meta)
      : "";
    return `${timestamp} ${level} ${label} ${stack || message}${rest}`;
  }),
);

/**
 * 按目录缓存底层 logger 实例，避免同一目录创建重复的文件句柄。
 * development 模式下所有模块共享同一个 console logger，key 固定为 "__console__"。
 */
const loggerCache = new Map<string, winston.Logger>();

function createLogger(logDir: string): winston.Logger {
  const cacheKey = isProduction ? logDir : "__console__";

  let cached = loggerCache.get(cacheKey);
  if (cached) return cached;

  const transports: winston.transport[] = [];
  if (isProduction) {
    transports.push(
      new winston.transports.DailyRotateFile({
        dirname: logDir,
        filename: "app-%DATE%.log",
        datePattern: "YYYY-MM-DD",
        level: "info",
        maxSize: "20m",
        maxFiles: "14d",
        zippedArchive: true,
        format: fileFormat,
      }),
    );
    transports.push(
      new winston.transports.DailyRotateFile({
        dirname: logDir,
        filename: "error-%DATE%.log",
        datePattern: "YYYY-MM-DD",
        level: "error",
        maxSize: "20m",
        maxFiles: "30d",
        zippedArchive: true,
        format: fileFormat,
      }),
    );
  } else {
    transports.push(
      new winston.transports.Console({
        level: "debug",
        format: consoleFormat,
      }),
    );
  }

  cached = winston.createLogger({
    level: isProduction ? "info" : "debug",
    transports,
    exitOnError: false,
  });
  loggerCache.set(cacheKey, cached);
  return cached;
}

/** 默认日志器（未指定模块时使用） */
export const logger = createLogger(DEFAULT_LOG_DIR);

/**
 * 带固定 module 标签的子 logger。
 * @param module 模块名，作为日志标签前缀
 * @param logDir 日志目录，未传入时用 process.env.LOG_DIR
 *
 * 用法：
 *   const log = createModuleLogger("rabbitmq");
 *   log.info("连接成功");
 *
 *   // 指定独立目录
 *   const log = createModuleLogger("worker", "/var/log/galleryrepo_worker");
 */
export function createModuleLogger(module: string, logDir?: string) {
  const dir = logDir || process.env.LOG_DIR || DEFAULT_LOG_DIR;
  return createLogger(dir).child({ module });
}
