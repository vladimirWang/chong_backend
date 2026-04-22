import { StockInListRow } from "./controllers/stockInController";
import { StockOutListRow } from "./controllers/stockOutController";
import { generateRedisKey } from "./utils/common";
import prisma from "./utils/prisma";
import { redisClient } from "./utils/redis";

export const initStockInServiceCode = async () => {
  try {
    const redisKeyPrefix = "stockInCode";
    const { redisKey, date } = generateRedisKey(redisKeyPrefix);

    // 查找所有 stockInCode 的 key（排除当天 key）
    const pattern = redisKeyPrefix + ":*";
    const keys: string[] = [];
    for await (const key of redisClient.scanIterator({
      MATCH: pattern,
      COUNT: 200,
    })) {
      const keyStr = key.toString().split(",");
      keys.push(...keyStr);
    }

    // 删除不是当天的业务编号
    keys.forEach((key) => {
      if (key !== redisKey) {
        redisClient.del(key);
      }
    });
    const redisValue = await redisClient.get(redisKey);

    const [stockInRecords] = await prisma.$queryRaw<StockInListRow[]>`
      SELECT * FROM StockIn
      WHERE serviceCode LIKE ${`JH${date}%`}
      ORDER BY CAST(RIGHT(serviceCode, 3) AS UNSIGNED) DESC
      LIMIT 1
    `;
    // console.log("-----------stockInRecords: -----------", stockInRecords);
    const indexStr = stockInRecords?.serviceCode.slice(-3);
    const index = indexStr ? parseInt(indexStr) : 0;

    if (!isNaN(index) && redisValue !== index.toString()) {
      await redisClient.set(redisKey, index);
    }
    return Promise.resolve();
  } catch (error) {
    console.error("initServiceCode error: ", error);
    return Promise.reject(error);
  }
};

export const initStockOutServiceCode = async () => {
  try {
    const redisKeyPrefix = "stockOutCode";
    const { redisKey, date } = generateRedisKey(redisKeyPrefix);

    // 查找所有 stockInCode 的 key（排除当天 key）
    const pattern = redisKeyPrefix + ":*";
    const keys: string[] = [];
    for await (const key of redisClient.scanIterator({
      MATCH: pattern,
      COUNT: 200,
    })) {
      const keyStr = key.toString().split(",");
      keys.push(...keyStr);
    }

    // 删除不是当天的业务编号
    keys.forEach((key) => {
      if (key !== redisKey) {
        redisClient.del(key);
      }
    });
    const redisValue = await redisClient.get(redisKey);

    const [stockOutRecords] = await prisma.$queryRaw<StockOutListRow[]>`
      SELECT * FROM StockOut
      WHERE serviceCode LIKE ${`CH${date}%`}
      ORDER BY CAST(RIGHT(serviceCode, 3) AS UNSIGNED) DESC
      LIMIT 1
    `;
    // console.log("-----------stockInRecords: -----------", stockInRecords);
    const indexStr = stockOutRecords?.serviceCode.slice(-3);
    const index = indexStr ? parseInt(indexStr) : 0;

    if (!isNaN(index) && redisValue !== index.toString()) {
      await redisClient.set(redisKey, index);
    }
    return Promise.resolve();
  } catch (error) {
    console.error("initServiceCode error: ", error);
    return Promise.reject(error);
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
