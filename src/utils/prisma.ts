import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const { DATABASE_URL } = process.env;

/** 有 deletedAt 字段，需要软删除过滤的模型（移植自 repo_backend） */
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
const TENANT_MODEL_SET = new Set<string>(TENANT_MODELS);

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
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

/** 基础 prisma 单例（进程级共享）：只加软删除过滤，不含 tenantId 注入 */
function createPrismaClient() {
  const adapter = new PrismaMariaDb(getDatabaseConfig());
  const basePrisma = new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error", "warn"],
  });

  return basePrisma.$extends({
    query: {
      $allModels: {
        async findMany({ args, query, model }) {
          if ((SOFT_DELETE_MODELS as readonly string[]).includes(model)) {
            if (!args.where) args.where = {};
            if (!("deletedAt" in (args.where as object))) {
              (args.where as Record<string, unknown>).deletedAt = null;
            }
          }
          return query(args);
        },
        async findFirst({ args, query, model }) {
          if ((SOFT_DELETE_MODELS as readonly string[]).includes(model)) {
            if (!args.where) args.where = {};
            if (!("deletedAt" in (args.where as object))) {
              (args.where as Record<string, unknown>).deletedAt = null;
            }
          }
          return query(args);
        },
        async findUnique({ args, query, model }) {
          if ((SOFT_DELETE_MODELS as readonly string[]).includes(model)) {
            if (!args.where) (args.where as any) = {};
            if (!("deletedAt" in (args.where as object))) {
              (args.where as Record<string, unknown>).deletedAt = null;
            }
          }
          return query(args);
        },
      },
    },
  });
}

/** prisma 基础单例（无租户场景/登录等用它，业务 CRUD 用 createTenantPrisma） */
export const basePrisma: ReturnType<typeof createPrismaClient> =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}

export default basePrisma;

export type BasePrismaClient = typeof basePrisma;

/**
 * 按请求的 tenantId 创建「租户级」prisma 扩展实例（移植自 repo_backend）
 *
 * - 对 TENANT_MODELS 的查询类操作自动追加 tenantId 条件
 * - create/createMany 强制通过 tenant.connect 写入 tenantId（Prisma 7 不允许 create data 写标量 FK relation）
 * - update/delete 同样限定 tenantId，避免跨租户误操作
 * - 轻量包装：复用底层连接池，不会新建数据库连接
 */
export function createTenantPrisma(tenantId: number) {
  return basePrisma.$extends({
    query: {
      $allModels: {
        // —— 查询类：注入 tenantId 到 where —— //
        async findMany({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model)) {
            if (!args.where) args.where = {} as Record<string, unknown>;
            (args.where as Record<string, unknown>).tenantId = tenantId;
          }
          return query(args);
        },
        async findFirst({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model)) {
            if (!args.where) args.where = {} as Record<string, unknown>;
            (args.where as Record<string, unknown>).tenantId = tenantId;
          }
          return query(args);
        },
        async findUnique({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model) && args.where) {
            args.where = {
              ...(args.where as object),
              tenantId,
            } as never;
          }
          return query(args);
        },
        async findFirstOrThrow({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model)) {
            if (!args.where) args.where = {} as Record<string, unknown>;
            (args.where as Record<string, unknown>).tenantId = tenantId;
          }
          return query(args);
        },
        async findUniqueOrThrow({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model) && args.where) {
            args.where = {
              ...(args.where as object),
              tenantId,
            } as never;
          }
          return query(args);
        },
        async count({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model)) {
            if (!args.where) args.where = {} as Record<string, unknown>;
            (args.where as Record<string, unknown>).tenantId = tenantId;
          }
          return query(args);
        },
        async aggregate({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model)) {
            if (!args.where) args.where = {} as Record<string, unknown>;
            (args.where as Record<string, unknown>).tenantId = tenantId;
          }
          return query(args);
        },
        async groupBy({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model)) {
            if (!args.where) args.where = {} as Record<string, unknown>;
            (args.where as Record<string, unknown>).tenantId = tenantId;
          }
          return query(args);
        },

        // —— 写入类：写入/删除/更新 都要限定 tenantId —— //
        async create({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model) && args.data) {
            const d = args.data as Record<string, unknown>;
            // Prisma 7：create data 里不能直接写 relation 标量 FK（tenantId），只能 tenant.connect
            delete d.tenantId;
            d.tenant = { connect: { id: tenantId } };
          }
          return query(args);
        },
        async createMany({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model) && args.data) {
            const rows = Array.isArray(args.data) ? args.data : [args.data];
            for (const row of rows) {
              const r = row as Record<string, unknown>;
              delete r.tenantId;
              r.tenant = { connect: { id: tenantId } };
            }
          }
          return query(args);
        },
        async upsert({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model)) {
            if (args.where)
              args.where = { ...(args.where as object), tenantId } as never;
            if (args.create) {
              const c = args.create as Record<string, unknown>;
              delete c.tenantId;
              c.tenant = { connect: { id: tenantId } };
            }
            if (args.update && typeof args.update === "object") {
              (args.update as Record<string, unknown>).tenantId = tenantId;
            }
          }
          return query(args);
        },
        async update({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model)) {
            if (!args.where) (args.where as any) = {};
            //  as Record<string, unknown>;
            args.where = { ...(args.where as object), tenantId } as never;
          }
          return query(args);
        },
        async updateMany({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model)) {
            if (!args.where) args.where = {} as Record<string, unknown>;
            (args.where as Record<string, unknown>).tenantId = tenantId;
          }
          return query(args);
        },
        async delete({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model)) {
            if (!args.where) (args.where as any) = {};
            //  as Record<string, unknown>;
            args.where = { ...(args.where as object), tenantId } as never;
          }
          return query(args);
        },
        async deleteMany({ args, query, model }) {
          if (TENANT_MODEL_SET.has(model)) {
            if (!args.where) args.where = {} as Record<string, unknown>;
            (args.where as Record<string, unknown>).tenantId = tenantId;
          }
          return query(args);
        },
      },
    },
  });
}

/** tenant prisma 实例类型 */
export type TenantPrismaClient = ReturnType<typeof createTenantPrisma>;
