import { createClient, type RedisClientType } from "@redis/client";

const redisClient: RedisClientType = createClient({
  url: process.env.REDIS_URL,
});

function connectRedis() {
  return redisClient
    .on("error", (err) => {
      console.error("Redis error:", err?.message);
    })
    .connect()
    .then((res) => {
      console.log("Redis 连接成功");
      return res;
    })
    .catch((err) => {
      console.error("Redis 连接失败:", err?.message);
      return Promise.reject(err);
    });
}
export { redisClient, connectRedis };
