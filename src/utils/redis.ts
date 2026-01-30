import { createClient, type RedisClientType } from "@redis/client";

const redisClient: RedisClientType = createClient({
  url: process.env.REDIS_URL,
  // 未设置用户名密码，使用默认无认证连接
});

function connectRedis() {
  return redisClient
    .on("error", (err) => {
      console.error("Redis error: ", err);
    })
    .connect()
    .then((res) => {
      console.log("redis connect success: ");
      return res;
    })
    .catch((err) => {
      console.error("redis connect fail: ", err);
      return Promise.reject(err);
    });
}
export { redisClient, connectRedis };
