import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const { DATABASE_URL } = process.env;

function getDatabaseConfig() {
  const baseConfig = {
    connectionLimit: 10,
    connectTimeout:
      process.env.NODE_ENV === "production" ? 30000 : 10000,
    // 解决 MySQL 8 caching_sha2_password 认证时 "RSA public key is not available" 错误
    allowPublicKeyRetrieval: true,
  };

  const url = DATABASE_URL;
  if (url) {
    const match = url.match(/mysql:\/\/([^:]+):([^@]*)@([^:]+):(\d+)\/([^?]+)/);
    if (match) {
      return {
        ...baseConfig,
        host: match[3],
        port: parseInt(match[4]),
        user: match[1],
        password: match[2],
        database: match[5],
      };
    }
  }

  // 默认配置（需本机已启动 MySQL/MariaDB）
  return {
    ...baseConfig,
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
    database: "gallery_hono_dev",
  };
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaMariaDb(getDatabaseConfig());
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error", "warn"],
  });
}

/** prisma 单例（进程级共享），业务扩展（软删除/租户隔离）后续按需追加 */
export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
