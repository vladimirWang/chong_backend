import { StockInListRow } from "./controllers/stockInController";
import { generateRedisKey } from "./utils/common";
import prisma from "./utils/prisma";
import { redisClient } from "./utils/redis";

export const initServiceCode = async () => {
  try {
    const redisKeyPrefix = "stockInCode";
    const { redisKey } = generateRedisKey(redisKeyPrefix);
    const redisValue = await redisClient.get(redisKey);

    const [stockInRecords] = await prisma.$queryRaw<StockInListRow[]>`
      SELECT * FROM StockIn
      WHERE serviceCode LIKE 'JH260331%'
      ORDER BY CAST(RIGHT(serviceCode, 3) AS UNSIGNED) DESC
      LIMIT 1
    `;
    const indexStr = stockInRecords?.serviceCode.slice(-3);
    const index = indexStr ? parseInt(indexStr) : 0;

    if (!isNaN(index) && redisValue !== index.toString()) {
      await redisClient.set(redisKey, index);
    }
  } catch (error) {
    console.error("initServiceCode error: ", error);
  }
};

export const getAnonymousUser = async () => {
  return prisma.adminUser.findFirst({
    where: {
      email: process.env.ANONYMOUS_EMAIL!,
    },
  });
};

/** 启动时由 index 写入；供嵌套路由等无法继承根 app `store` 类型的 handler 使用 */
let anonymousAdminUserId: number | null = null;

export const setAnonymousAdminUserId = (id: number) => {
  anonymousAdminUserId = id;
};

export const getAnonymousAdminUserId = (): number => {
  if (anonymousAdminUserId === null) {
    throw new Error("Anonymous admin user id not initialized");
  }
  return anonymousAdminUserId;
};
