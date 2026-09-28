import { redisClient } from "./redis";

/**
 * 缓存查询装饰器（高阶函数形式）
 *
 * 用于读取 Redis 缓存：命中则返回反序列化后的数据，未命中返回 undefined。
 * 不执行任何回源逻辑，调用方需自行决定未命中时的处理（如查库后回填缓存）。
 *
 * 泛型 T 在调用时指定，使同一缓存前缀可按不同类型读取。
 *
 * @param keyPrefix 缓存 key 前缀（建议带业务语义，如 "product:detail"）
 * @returns 查询函数：接收 key 后缀，返回缓存数据或 undefined
 *
 * @example
 * ```ts
 * const getCachedProduct = cacheQuery("product:detail");
 * const detail = await getCachedProduct<ProductDetail>(`${tenantId}:${productId}`);
 * if (detail) {
 *   // 命中缓存
 * } else {
 *   // 未命中，回源查库
 * }
 * ```
 */
export function cacheQuery(keyPrefix: string) {
  return async <T>(keySuffix: string | number): Promise<T | undefined> => {
    const cacheKey = `${keyPrefix}:${keySuffix}`;
    const cached = await redisClient.get(cacheKey);
    if (cached === null || cached === undefined) {
      return undefined;
    }
    try {
      return JSON.parse(cached) as T;
    } catch {
      // 缓存数据损坏时视为未命中，避免阻塞业务
      return undefined;
    }
  };
}

/**
 * 缓存 aside 装饰器（读穿透 + 回源回填）
 *
 * 先查缓存（复用 cacheQuery），命中直接返回；未命中执行 loader 回源查询，
 * 结果非空则回填缓存后返回，为空则不回填（避免缓存穿透）。
 *
 * 泛型 T 从 loader 的返回类型自动推断，调用方无需手写类型。
 *
 * @param keyPrefix 缓存 key 前缀（建议带业务语义，如 "product:detail"）
 * @param ttlSeconds 缓存过期时间（秒），不传或 <=0 则不过期
 * @returns 装饰后的查询函数：接收 key 后缀与 loader，返回缓存或回源数据
 *
 * @example
 * ```ts
 * const getProduct = cacheAside("product:detail", 600);
 * const detail = await getProduct(`${tenantId}:${id}`, async () => {
 *   return await db.product.findUnique({ where: { id } });
 * });
 * ```
 */
export function cacheAside(keyPrefix: string, ttlSeconds?: number) {
  const readCache = cacheQuery(keyPrefix);
  return async <T>(
    keySuffix: string | number,
    loader: () => Promise<T | null | undefined>,
  ): Promise<T | undefined> => {
    // 1. 查缓存
    const cached = await readCache<T>(keySuffix);
    if (cached !== undefined) {
      return cached;
    }
    // 2. 未命中，回源查询
    const data = await loader();
    if (data === undefined || data === null) {
      return undefined;
    }
    // 3. 回填缓存
    const cacheKey = `${keyPrefix}:${keySuffix}`;
    const serialized = JSON.stringify(data);
    if (ttlSeconds !== undefined && ttlSeconds > 0) {
      await redisClient.setEx(cacheKey, ttlSeconds, serialized);
    } else {
      await redisClient.set(cacheKey, serialized);
    }
    return data;
  };
}
