import { createHash, randomBytes } from "node:crypto";
import { redisClient } from "./redis";

// 工具函数：生成固定盐（用户注册时用）
export function generateFixedSalt() {
  // Bun 下全局 crypto 是 Web Crypto，须用 node:crypto 的 randomBytes
  return randomBytes(16).toString("hex");
}

// 工具函数：SHA256哈希
export function sha256(str: string) {
  return createHash("sha256").update(str, "utf8").digest("hex");
}

// 工具函数：生成一次性nonce（登录前获取）
export function generateNonce() {
  const randomStr = randomBytes(16).toString("hex");
  const timestamp = Date.now().toString();
  return `${randomStr}_${timestamp}`;
}

// 工具函数：校验nonce有效性（5分钟有效期 + redis 防重放）
export async function isValidNonce(nonce: string) {
  const [randomPart, timestamp] = nonce.split("_");
  if (!randomPart || !timestamp) return false;
  if (Date.now() - Number(timestamp) > 300000) return false;
  const nonceRedisKey = `nonce:${nonce}`;
  const nonceInRedis = await redisClient.get(nonceRedisKey);
  if (nonceInRedis) return false;
  await redisClient.setEx(nonceRedisKey, 300, "1");
  return true;
}
