import { Elysia, t } from "elysia";
import "dotenv/config";
// 从 routers/index.ts 统一导入所有路由模块
import { apiRouter } from "./routers";
import { uploadFile, uploadExcelFile } from "./controllers/uploadController";
import { ErrorResponse, errorCode } from "./models/Response";
import { ValidationError } from "elysia";
import { ZodError } from "zod";
import { authPlugin } from "./macro/auth.macro";
import { jwt } from "@elysiajs/jwt";
const { JWT_SECRET } = process.env;
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { authService } from "./macro/auth.macro";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { connectRedis } from "./utils/redis";

// 注册插件
dayjs.extend(utc);
dayjs.extend(timezone);

await connectRedis();
// dayjs.tz.setDefault("Asia/Shanghai");
// dayjs.tz.setDefault("Europe/London");

// 创建主应用并注册所有路由模块
export const app = new Elysia()
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
              // 提取错误消息，可能在不同的属性中
              if (err.message) return err.message;
              if (typeof err === "string") return err;
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

    // 其他错误继续抛出
    throw error;
  })
  .use(apiRouter)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
