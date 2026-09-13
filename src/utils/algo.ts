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

/** Σ (单价 * count)，移植自 repo_backend utils/algo */
export function sum2<T extends { count: number }, K extends keyof T>(
  data: T[],
  key: K,
): number {
  return data.reduce(
    (a, c) => a + ((c[key] as number) ?? 0) * c.count,
    0,
  );
}

export type CompareArrayResult<T> = {
  added: T[];
  modified: T[];
  deleted: T[];
  unchanged: T[];
};

/** 简单深比较（替代老实现对 lodash isEqual 的依赖） */
function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (typeof a !== "object") return false;
  const aIsArr = Array.isArray(a);
  if (aIsArr !== Array.isArray(b)) return false;
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keysA = Object.keys(ao);
  const keysB = Object.keys(bo);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) =>
    isDeepEqual(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
    ),
  );
}

/**
 * 按 idKey 对比新旧两个对象数组，分类为 added/modified/deleted/unchanged
 * 对比时忽略 ignoreFields 中的字段（移植自 repo_backend，去掉了 lodash 依赖）
 */
export function compareArrayMinLoop<T extends object>(
  oldArr: T[],
  newArr: T[],
  idKey: keyof T,
  ignoreFields: string[] = [],
): CompareArrayResult<T> {
  const result: CompareArrayResult<T> = {
    added: [],
    modified: [],
    deleted: [],
    unchanged: [],
  };

  const oldMap = new Map<unknown, T>();
  oldArr.forEach((item) => {
    const idValue = (item as Record<string, unknown>)[idKey as string];
    if (idValue !== null && idValue !== undefined) {
      oldMap.set(idValue, item);
    }
  });

  for (const newItem of newArr) {
    const currentId = (newItem as Record<string, unknown>)[idKey as string];
    if (currentId === null || currentId === undefined) continue;

    const oldItem = oldMap.get(currentId);
    if (!oldItem) {
      result.added.push(newItem);
      continue;
    }
    const filter = (o: T) =>
      Object.fromEntries(
        Object.entries(o as Record<string, unknown>).filter(
          ([k]) => !ignoreFields.includes(k),
        ),
      );
    if (isDeepEqual(filter(oldItem), filter(newItem))) {
      result.unchanged.push(newItem);
    } else {
      result.modified.push(newItem);
    }
    oldMap.delete(currentId);
  }

  result.deleted = [...oldMap.values()];
  return result;
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
