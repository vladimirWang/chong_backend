import { createClient, type RedisClientType } from "@redis/client";

const redisClient: RedisClientType = createClient({
  url: process.env.REDIS_URL,
  // 未设置用户名密码，使用默认无认证连接
});

redisClient.on("error", (err) => {
  console.error("Redis error: ", err);
});

export { redisClient };
