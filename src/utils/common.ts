import { redisClient } from "./redis";

interface GenerateServiceCodeResult {
  serviceCode: string;
  previousValue: number | null;
}

/** YYMMDD（本地时间） */
function formatYYMMDD(d: Date): string {
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

/**
 * 生成业务单号（移植自 repo_backend utils/common）
 * @param prefix 单号前缀，如进货 "JH"、出货 "CH"
 * @param redisKeyPrefix redis 计数 key 前缀，如 "stockInCode"
 *
 * Redis INCR 原子自增保证并发不重复；当天首次生成时 key 过期时间设到当日结束。
 * 用原生 Date 替代老实现的 dayjs。
 */
export async function generateServiceCode(
  prefix: string,
  redisKeyPrefix: string,
): Promise<GenerateServiceCodeResult> {
  const now = new Date();
  const date = formatYYMMDD(now);
  const redisKey = `${redisKeyPrefix}:${date}`;
  const head = `${prefix}${date}`;

  const currentValue = await redisClient.incr(redisKey);
  if (currentValue === 1) {
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    await redisClient.expireAt(redisKey, Math.floor(endOfDay.getTime() / 1000));
  }

  return {
    serviceCode: head + currentValue.toString().padStart(3, "0"),
    previousValue: currentValue > 1 ? currentValue - 1 : null,
  };
}
