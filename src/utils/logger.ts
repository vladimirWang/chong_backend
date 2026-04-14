/**
 * 统一日志工具
 * - development: 输出到控制台，便于调试
 * - prod/staging: 输出到文件 logs/app.log
 */

import pino from "pino";
import { createWriteStream, mkdirSync } from "fs";
import { join } from "path";

const isDev = process.env.NODE_ENV === "development";

function createLogger() {
  if (isDev) {
    return pino(
      {
        level: process.env.LOG_LEVEL || "debug",
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      pino.destination(1),
    );
  }

  const logDir = process.env.LOG_DIR || "logs";
  const appLogPath = join(logDir, "app.log");
  const errorLogPath = join(logDir, "error.log");

  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    /* 目录已存在则忽略 */
  }

  const appStream = createWriteStream(appLogPath, { flags: "a" });
  const errorStream = createWriteStream(errorLogPath, { flags: "a" });

  const logger = pino(
    {
      level: process.env.LOG_LEVEL || "info",
      formatters: {
        level: (label) => ({ level: label }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.multistream([
      { stream: appStream },
      {
        stream: errorStream,
        level: "error",
      },
    ]),
  );

  return logger;
}

export const logger = createLogger();

export default logger;
