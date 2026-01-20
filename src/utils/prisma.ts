import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import type { Prisma } from "@prisma/client";

const { DATABASE_URL } = process.env;

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

function getDatabaseConfig(){
    if (
    process.env.DATABASE_HOST &&
    process.env.DATABASE_USER &&
    process.env.DATABASE_NAME
  ) {
    return {
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT || "3306"),
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD || "",
      database: process.env.DATABASE_NAME,
      connectionLimit: 10,
    };
  }
    const url = process.env.DATABASE_URL;
  if (url) {
    const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (match) {
      return {
        host: match[3],
        port: parseInt(match[4]),
        user: match[1],
        password: match[2],
        database: match[5],
        connectionLimit: 10,
      };
    }
  }

  // 默认配置
  return {
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
    database: "prisma_demo",
    connectionLimit: 10,
  };
}

const adapter = new PrismaMariaDb(getDatabaseConfig());

function createPrismaClient() {
  const basePrisma = new PrismaClient({
    adapter,
    // log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    log: ["query", "error", "warn"]
  });

  // 使用 $extends 添加软删除过滤逻辑
  return basePrisma.$extends({
    query: {
      $allModels: {
        async findMany({ args, query, model }) {
          // 检查模型是否有 deletedAt 字段
          // 只有 Vendor, Product, StockIn 有 deletedAt 字段
          const hasDeletedAt = model === 'Vendor' || model === 'Product' || model === 'StockIn';
          
          if (hasDeletedAt) {
            // 在查询之前修改 args
            if (!args.where) {
              args.where = {};
            }
            
            // 只有当 deletedAt 条件未设置时，才自动过滤已删除的记录
            if (!('deletedAt' in args.where)) {
              (args.where as any).deletedAt = null;
            }
          }
          
          // 执行查询
          const result = await query(args);
          return result;
        },
      },
    },
  });
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;

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