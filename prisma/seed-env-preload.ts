/**
 * 在加载 `src/utils/prisma` 之前执行，保证与 `src/index.ts` 一致地读入 env 文件。
 * 通过 `bun --preload` 注册；Docker 内通常无 .env 文件，依赖 compose 注入变量。
 */
import { config } from "dotenv";
import { existsSync } from "fs";

const envFile =
  process.env.NODE_ENV === "development"
    ? ".env.dev"
    : process.env.ENV_FILE || ".env.prod";
if (existsSync(envFile)) {
  config({ path: envFile });
}
