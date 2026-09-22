import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * datasource.url 取 process.env.DATABASE_URL：
 * - Docker build（prisma generate）：无 env_file → undefined（generate 不连 DB，允许）
 * - docker-entrypoint.sh（migrate deploy）：.env.prod 已加载 → 有值
 * - 本地 dev（migrate dev）：dotenv/config 已加载 .env.* → 有值
 *
 * 故意不引入 env() 严格校验——generate 阶段不能因为缺 env 挂掉。
 * migrate 等需要 DB 的命令，Prisma 自身会在 URL 为空时报错。
 */

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "bun --preload ./prisma/seed-env-preload.ts ./prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
    // shadowDatabaseUrl 只在 prisma migrate dev / migrate diff 时需要；
    // generate/deploy 都不需要，所以用 process.env 可选读取，不存在就省略
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
