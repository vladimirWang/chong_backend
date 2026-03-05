/**
 * Elysia 请求日志插件
 * 记录请求进入与响应完成，错误由全局 onError 记录
 */

import { Elysia } from "elysia";
import { logger } from "../utils/logger";

export const loggerPlugin = new Elysia({ name: "logger" })
  .onRequest(({ request }) => {
    const url = new URL(request.url);
    logger.info({
      msg: "request",
      method: request.method,
      path: url.pathname,
      query: url.search || undefined,
    });
  })
  .onAfterResponse(({ request, set }) => {
    const url = new URL(request.url);
    logger.info({
      msg: "response",
      method: request.method,
      path: url.pathname,
      status: set.status || 200,
    });
  });
