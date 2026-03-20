import { Elysia, t } from "elysia";
import { config } from "dotenv";
import { existsSync } from "fs";
import { logger } from "./utils/logger";
import { staticPlugin } from "@elysiajs/static";
import { apiRouter } from "./routers";
import { loggerPlugin } from "./plugins/loggerPlugin";
import { uploadFile, uploadExcelFile } from "./controllers/uploadController";
import { ErrorResponse, errorCode } from "./models/Response";
import { ValidationError } from "elysia";
import { ZodError } from "zod";
import { authPlugin } from "./macro/auth.macro";
import { jwt } from "@elysiajs/jwt";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { authService } from "./macro/auth.macro";
import { readFile } from "fs/promises";
import { join } from "path";
import { connectRedis } from "./utils/redis";
import path from "node:path";
import { ensureDirExists, UPLOAD_DIR } from "./utils/file";
import { createDailyUserInsertJob } from "./plugins/dailyUserInsertJob";

// 开发环境使用 .env.development；生产/测试可由 ENV_FILE 指定（与 docker-compose env_file 一致）
const envFile =
  process.env.NODE_ENV === "development"
    ? ".env.development"
    : process.env.ENV_FILE || ".env.production";
if (existsSync(envFile)) {
  config({ path: envFile });
}
const { JWT_SECRET } = process.env;

ensureDirExists(UPLOAD_DIR);

// // 注册插件
// dayjs.extend(utc);
// dayjs.extend(timezone);

await connectRedis();
// dayjs.tz.setDefault("Asia/Shanghai");
// dayjs.tz.setDefault("Europe/London");

// 创建主应用并注册所有路由模块
export const app = new Elysia()
  .use(
    staticPlugin({
      // 使用绝对路径：相对路径在 Docker/生产环境中 process.cwd() 可能不是项目根目录，导致静态资源 404
      assets:
        process.env.NODE_ENV === "development"
          ? "./public"
          : path.join(import.meta.dir, "..", "public"),
      prefix: "/public",
      // uploads 目录下的文件是运行时上传的，必须用懒加载模式
      alwaysStatic: false,
    }),
  )
  .use(loggerPlugin)
  .use(createDailyUserInsertJob())
  .use(
    jwt({
      name: "jwt",
      secret: JWT_SECRET!,
    }),
  )
  .use(authService)
  .get("/", () => "Hello Elysia")
  // 全局错误处理 - 拦截 zod 校验异常
  .onError(({ code, error, url }) => {
    // 直接处理 ZodError（包括在 beforeHandle 中抛出的）
    if (error instanceof ZodError) {
      const errorMessages = error.issues.map((issue) => issue.message);
      const errorMessage =
        errorMessages.length > 0 ? errorMessages.join(", ") : "校验失败";

      const result = new ErrorResponse(
        errorCode.VALIDATION_ERROR,
        errorMessage,
      );
      return new Response(JSON.stringify(result), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 处理 Elysia 的 VALIDATION 错误（zod schema 校验失败）
    if (code === "VALIDATION") {
      // 提取 zod 错误信息
      let errorMessage = "校验失败";

      // 尝试从错误中提取详细信息
      // 检查是否是 ValidationError 类型
      if (error instanceof ValidationError) {
        const validationError = error as any;

        // Elysia 的 ValidationError 通常包含 all 属性，包含所有校验错误
        if (validationError.all && Array.isArray(validationError.all)) {
          const errorMessages = validationError.all
            .map((err: any) => {
              const currentParam = `path: ${JSON.stringify(err.value)}`;
              // 提取错误消息，可能在不同的属性中
              if (err.message)
                return err.message + `; currentParam: ${currentParam}`;
              if (typeof err === "string")
                return err + `; currentParam: ${currentParam}`;
              if (err.value !== undefined) {
                // 可能是格式化的错误对象
                return `${err.path || ""}: ${err.message || "校验失败"}`;
              }
              return "校验失败";
            })
            .filter((msg: string) => msg && msg !== "校验失败");

          if (errorMessages.length > 0) {
            errorMessage = errorMessages.join(", ");
          }
        } else if (validationError.validator?.Error) {
          // 尝试从 validator.Error 中提取 zod 错误信息
          const zodError = validationError.validator.Error;
          if (
            zodError.issues &&
            Array.isArray(zodError.issues) &&
            zodError.issues.length > 0
          ) {
            errorMessage = zodError.issues
              .map((issue: any) => issue.message)
              .join(", ");
          }
        } else if (validationError.message) {
          errorMessage = validationError.message;
        }
      } else if (error instanceof Error) {
        // 如果是普通 Error 对象，直接使用 message
        errorMessage = error.message;
      }

      const result = new ErrorResponse(
        errorCode.VALIDATION_ERROR,
        errorMessage,
      );
      return new Response(JSON.stringify(result), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 处理 404 错误（路由不存在）
    if (code === "NOT_FOUND") {
      const result = new ErrorResponse(
        errorCode.NOT_FOUND,
        "路由不存在: " + url,
      );
      return new Response(JSON.stringify(result), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 未捕获错误记录后继续抛出
    logger.error(
      { error: error?.message, stack: error?.stack, url },
      "未捕获异常",
    );
    throw error;
  })
  .use(apiRouter)
  .listen(Number(process.env.PORT) || 3000);

logger.info(
  {
    msg: "服务启动",
    host: app.server?.hostname,
    port: app.server?.port,
    env: process.env.NODE_ENV,
  },
  `Elysia 已启动 http://${app.server?.hostname}:${app.server?.port}`,
);
