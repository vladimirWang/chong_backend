import { Elysia } from "elysia";
import { config } from "dotenv";
import { existsSync } from "fs";
import { logger } from "./utils/logger";
import { staticPlugin } from "@elysiajs/static";
import { apiRouter } from "./routers";
import { githubApiAuthRouter } from "./routers/githubApiAuthRouter";
import { loggerPlugin } from "./plugins/loggerPlugin";
import { uploadFile, uploadExcelFile } from "./controllers/uploadController";
import { ErrorResponse, errorCode } from "./models/Response";
import { ValidationError } from "elysia";
import { ZodError } from "zod";
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
import {
  getAnonymousUser,
  initStockInServiceCode,
  initStockOutServiceCode,
  setAnonymousAdminUserId,
} from "./init";

// // 开发环境使用 .env.development；生产/测试可由 ENV_FILE 指定（与 docker-compose env_file 一致）
// let envFile = '.env.devLocal'
// if (process.env.NODE_ENV === "production") {
//   envFile = ".env.prod";
// }

// if (existsSync(envFile)) {
//   config({ path: envFile });
// }
const { JWT_SECRET } = process.env;

ensureDirExists(UPLOAD_DIR);

// // // 注册插件
// // dayjs.extend(utc);
// // dayjs.extend(timezone);

// await connectRedis();
// await initStockInServiceCode();
// await initStockOutServiceCode();
// const anonymousUser = await getAnonymousUser();
// console.log("anonymousUser: ", anonymousUser);
// if (!anonymousUser) {
//   throw new Error("Anonymous user not found");
// }
// setAnonymousAdminUserId(anonymousUser.id);

// dayjs.tz.setDefault("Asia/Shanghai");
// dayjs.tz.setDefault("Europe/London");

// 创建主应用并注册所有路由模块
export const app = new Elysia()
  .state("anonymousUserId", anonymousUser.id)
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
  // .use(loggerPlugin)
  // .use(createDailyUserInsertJob())
  .use(
    jwt({
      name: "jwt",
      secret: JWT_SECRET!,
    }),
  )
  .get("/", () => "Hello Elysia")
  // // 全局错误处理 - 拦截 zod 校验异常
  // .onError(({ code, error, path }) => {
  //   console.error("--------Error occurred at path:---------", path, "with error:", error);
  //   // 直接处理 ZodError（包括在 beforeHandle 中抛出的）
  //   if (error instanceof ZodError) {
  //     const errorMessages = error.issues.map((issue) => issue.message);
  //     const errorMessage =
  //       errorMessages.length > 0 ? errorMessages.join(", ") : "校验失败";

  //     const result = new ErrorResponse(
  //       errorCode.VALIDATION_ERROR,
  //       errorMessage,
  //     );
  //     return new Response(JSON.stringify(result), {
  //       status: 400,
  //       headers: { "Content-Type": "application/json" },
  //     });
  //   }

  //   // 处理 Elysia 的 VALIDATION 错误（zod schema 校验失败）
  //   if (code === "VALIDATION") {
  //     // 提取 zod 错误信息
  //     let errorMessage = "校验失败";

  //     // 尝试从错误中提取详细信息
  //     // 检查是否是 ValidationError 类型
  //     if (error instanceof ValidationError) {
  //       const validationError = error as any;

  //       // Elysia 的 ValidationError 通常包含 all 属性，包含所有校验错误
  //       if (validationError.all && Array.isArray(validationError.all)) {
  //         const errorMessages = validationError.all
  //           .map((err: any) => {
  //             if (!err) return undefined;
  //             if (typeof err === "string") return err;

  //             const msg =
  //               err.message ??
  //               err.summary ??
  //               err.error?.message ??
  //               err.validator?.message;
  //             const p = Array.isArray(err.path)
  //               ? err.path.join(".")
  //               : typeof err.path === "string"
  //                 ? err.path
  //                 : undefined;

  //             if (msg && p) return `${p}: ${msg}`;
  //             if (msg) return String(msg);

  //             return undefined;
  //           })
  //           .filter(Boolean) as string[];

  //         if (errorMessages.length > 0) {
  //           errorMessage = errorMessages.join(", ");
  //         }
  //       }

  //       const zodErrorCandidate =
  //         validationError.validator?.Error ??
  //         validationError.error ??
  //         validationError.cause;
  //       if (
  //         zodErrorCandidate?.issues &&
  //         Array.isArray(zodErrorCandidate.issues) &&
  //         zodErrorCandidate.issues.length > 0
  //       ) {
  //         errorMessage = zodErrorCandidate.issues
  //           .map((issue: any) => issue.message)
  //           .join(", ");
  //       } else if (validationError.message) {
  //         errorMessage = validationError.message;
  //       }
  //     } else if (error instanceof Error) {
  //       // 如果是普通 Error 对象，直接使用 message
  //       errorMessage = error.message;
  //     }

  //     // Elysia 有时会把结构化校验信息序列化成 JSON 字符串塞进 message
  //     if (typeof errorMessage === "string") {
  //       const trimmed = errorMessage.trim();
  //       if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
  //         try {
  //           const parsed = JSON.parse(trimmed) as any;
  //           const prop =
  //             typeof parsed?.property === "string" ? parsed.property : undefined;
  //           const msg =
  //             typeof parsed?.message === "string" ? parsed.message : undefined;
  //           if (msg) {
  //             errorMessage = prop ? `${prop}: ${msg}` : msg;
  //           }
  //         } catch {
  //           // ignore JSON parse failure, fall back to original message
  //         }
  //       }

  //       // 常见英文校验消息本地化
  //       if (errorMessage.includes("Invalid email address")) {
  //         errorMessage = errorMessage.replace(
  //           "Invalid email address",
  //           "邮箱格式不正确",
  //         );
  //       }
  //     }

  //     const result = new ErrorResponse(
  //       errorCode.VALIDATION_ERROR,
  //       errorMessage,
  //     );
  //     return new Response(JSON.stringify(result), {
  //       status: 400,
  //       headers: { "Content-Type": "application/json" },
  //     });
  //   }

  //   // 处理 404 错误（路由不存在）
  //   if (code === "NOT_FOUND") {
  //     const result = new ErrorResponse(
  //       errorCode.NOT_FOUND,
  //       "路由不存在: " + path,
  //     );
  //     return new Response(JSON.stringify(result), {
  //       status: 404,
  //       headers: { "Content-Type": "application/json" },
  //     });
  //   }

  //   // 未捕获错误记录后继续抛出
  //   const errForLog =
  //     error instanceof Error
  //       ? { message: error.message, stack: error.stack }
  //       : { message: String(error), stack: undefined as string | undefined };
  //   logger.error(
  //     { error: errForLog.message, stack: errForLog.stack, path },
  //     "未捕获异常",
  //   );
  //   const result = new ErrorResponse(
  //     errorCode.INTERNAL_ERROR,
  //     "服务器内部错误",
  //   );
  //   return new Response(JSON.stringify(result), {
  //     status: 500,
  //     headers: { "Content-Type": "application/json" },
  //   });
  // })
  // // .use(githubApiAuthRouter)
  // .use(apiRouter)
  .listen(4000);
console.log("app.server: ", app.server);
// logger.info(
//   {
//     msg: "服务启动",
//     host: app.server?.hostname,
//     port: app.server?.port,
//     env: process.env.NODE_ENV,
//   },
//   `Elysia 已启动 http://${app.server?.hostname}:${app.server?.port}`,
// );
