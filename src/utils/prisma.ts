import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import type { Prisma } from "@prisma/client";

const { DATABASE_URL } = process.env;

/** 有 deletedAt 字段，需要软删除过滤的模型 */
const SOFT_DELETE_MODELS = [
  "Vendor",
  "Product",
  "StockIn",
  "StockOut",
  "User",
  "ProductJoinStockIn",
  "ProductJoinStockOut",
  "HistoryCost",
  "FileInfo",
  "Client",
  "Platform",
] as const;

/** 业务表：带 tenantId 需要租户隔离的模型（NOT NULL tenantId） */
export const TENANT_MODELS = [
  "Vendor",
  "Product",
  "StockIn",
  "StockOut",
  "User",
  "ProductJoinStockIn",
  "ProductJoinStockOut",
  "HistoryCost",
  "FileInfo",
  "Client",
] as const;
type TenantModel = (typeof TENANT_MODELS)[number];
const TENANT_MODEL_SET = new Set<string>(TENANT_MODELS);

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

function getDatabaseConfig() {
  const baseConfig = {
    connectionLimit: 10,
    connectTimeout:
      process.env.NODE_ENV === "production" ? 30000 : 10000,
    // 解决 MySQL 8 caching_sha2_password 认证时 "RSA public key is not available" 错误
    allowPublicKeyRetrieval: true,
  };

  if (
    process.env.DATABASE_HOST &&
    process.env.DATABASE_USER &&
    process.env.DATABASE_NAME
  ) {
    return {
      ...baseConfig,
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT || "3306"),
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD || "",
      database: process.env.DATABASE_NAME,
    };
  }
  const url = process.env.DATABASE_URL;
  if (url) {
    const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
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
    database: "prisma_demo",
  };
}

const adapter = new PrismaMariaDb(getDatabaseConfig());

/** 基础 prisma 单例（进程级共享），只加了软删除，不含 tenantId 注入 */
function createPrismaClient() {
  const basePrisma = new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error", "warn"],
  });

  // 软删除过滤（全局生效，不区分租户）
  return basePrisma.$extends({
    query: {
      $allModels: {
        async findMany({ args, query, model }) {
          if (SOFT_DELETE_MODELS.includes(model as any)) {
            if (!args.where) args.where = {};
            if (!("deletedAt" in (args.where as any))) {
              (args.where as any).deletedAt = null;
            }
          }
          return query(args);
        },
        async findFirst({ args, query, model }) {
          if (SOFT_DELETE_MODELS.includes(model as any)) {
            if (!args.where) args.where = {};
            if (!("deletedAt" in (args.where as any))) {
              (args.where as any).deletedAt = null;
            }
          }
          return query(args);
        },
        async findUnique({ args, query, model }) {
          if (SOFT_DELETE_MODELS.includes(model as any)) {
            if (!args.where) args.where = {};
            if (!("deletedAt" in (args.where as any))) {
              (args.where as any).deletedAt = null;
            }
          }
          return query(args);
        },
      },
    },
  });
}

/** prisma 基础单例导出（用于 admin/公共无租户场景、内部初始化等） */
export const basePrisma: ReturnType<typeof createPrismaClient> =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}

export default basePrisma;

/** prisma 基础单例的原始类型（未 $extends 的 PrismaClient 实例），用于 tx 参数类型推导 */
export type BasePrismaClient = typeof basePrisma;

/**
 * 按请求的 tenantId 创建「租户级」prisma 扩展实例。
 *
 * - 对 TENANT_MODEL_SET 内的所有查询类操作，自动追加 tenantId 条件
 * - 对 create/createMany，自动强制写入 tenantId（防止 NOT NULL 失败）
 * - update/delete 操作同样限定 tenantId，避免跨租户误操作
 * - 轻量包装：复用底层连接池，不会新建数据库连接
 */
export function createTenantPrisma(
  _base: typeof basePrisma,
  tenantId: number,
) {
  return basePrisma.$extends({
    query: {
      $allModels: {
        // —— 查询类：注入 tenantId 到 where —— //
        async findMany({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model)) {
            if (!args.where) args.where = {} as any;
            (args.where as any).tenantId = tenantId;
          }
          return query(args);
        },
        async findFirst({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model)) {
            if (!args.where) args.where = {} as any;
            (args.where as any).tenantId = tenantId;
          }
          return query(args);
        },
        async findUnique({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model) && args.where) {
            args.where = { ...(args.where as any), tenantId } as any;
          }
          return query(args);
        },
        async findFirstOrThrow({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model)) {
            if (!args.where) args.where = {} as any;
            (args.where as any).tenantId = tenantId;
          }
          return query(args);
        },
        async findUniqueOrThrow({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model) && args.where) {
            args.where = { ...(args.where as any), tenantId } as any;
          }
          return query(args);
        },
        async count({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model)) {
            if (!args.where) args.where = {} as any;
            (args.where as any).tenantId = tenantId;
          }
          return query(args);
        },
        async aggregate({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model)) {
            if (!args.where) args.where = {} as any;
            (args.where as any).tenantId = tenantId;
          }
          return query(args);
        },
        async groupBy({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model)) {
            if (!args.where) args.where = {} as any;
            (args.where as any).tenantId = tenantId;
          }
          return query(args);
        },

        // —— 写入类：写入/删除/更新 都要限定 tenantId —— //
        async create({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model) && args.data) {
            (args.data as any).tenantId = tenantId;
          }
          return query(args);
        },
        async createMany({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model) && args.data) {
            const rows = Array.isArray(args.data) ? args.data : [args.data];
            for (const row of rows) (row as any).tenantId = tenantId;
          }
          return query(args);
        },
        async upsert({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model)) {
            if (args.where) args.where = { ...(args.where as any), tenantId } as any;
            if (args.create) (args.create as any).tenantId = tenantId;
            if (args.update && typeof args.update === "object") {
              (args.update as any).tenantId = tenantId;
            }
          }
          return query(args);
        },
        async update({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model)) {
            if (!args.where) args.where = {} as any;
            args.where = { ...(args.where as any), tenantId } as any;
          }
          return query(args);
        },
        async updateMany({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model)) {
            if (!args.where) args.where = {} as any;
            (args.where as any).tenantId = tenantId;
          }
          return query(args);
        },
        async delete({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model)) {
            if (!args.where) args.where = {} as any;
            args.where = { ...(args.where as any), tenantId } as any;
          }
          return query(args);
        },
        async deleteMany({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model)) {
            if (!args.where) args.where = {} as any;
            (args.where as any).tenantId = tenantId;
          }
          return query(args);
        },
      },
    },
  });
}

/** tenant prisma 实例类型 */
export type TenantPrismaClient = ReturnType<typeof createTenantPrisma>;

// console.log(result.parsed, '---parsed');
// const prisma = new PrismaClient({
//   log: ["info", "error"],
//   datasources: {
//     db: {
//       url: DATABASE_URL,
//     },
//   },
// });

// prisma
//   .$connect()
//   // .then(() => {console.log('connected')})
//   .catch((err) => {
//     console.log("disconnected, because: ", err.message);
//   });
// export default prisma;
