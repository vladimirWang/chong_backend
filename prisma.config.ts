import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "bun --preload ./prisma/seed-env-preload.ts ./prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
    // shadowDatabaseUrl 只在 prisma migrate dev / migrate diff 时需要；
    // generate/deploy 都不需要，所以用 process.env 可选读取，不存在就省略
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
