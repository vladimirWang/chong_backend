import { createClient, type RedisClientType } from "@redis/client";
import { createModuleLogger } from "./logger";

const logger = createModuleLogger("redis");

const redisClient: RedisClientType = createClient({
  url: process.env.REDIS_URL,
});

function connectRedis() {
  return redisClient
    .on("error", (err) => {
      logger.error("Redis error", { error: err?.message });
    })
    .connect()
    .then((res) => {
      logger.info("Redis 连接成功");
      return res;
    })
    .catch((err) => {
      logger.error("Redis 连接失败", { error: err?.message });
      return Promise.reject(err);
    });
}
export { redisClient, connectRedis };
