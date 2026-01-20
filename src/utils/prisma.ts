import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const { DATABASE_URL } = process.env;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
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

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

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