import dayjs from "dayjs";
import { redisClient } from "./redis";

interface IGenerateServiceResult {
  serviceCode: string;
  previousValue: number | null;
}
// 生成进货单号
export async function generateServiceCode(
  serviceCode: string, // 服务单号前缀
  redisKeyPrefix: string, // 缓存key
): Promise<IGenerateServiceResult> {
  const date = dayjs().format("YYMMDD");
  const redisKey = `${redisKeyPrefix}:${date}`;
  const head = `${serviceCode}${date}`;

  // 使用 Redis 原子自增保证并发下不重复
  // - `INCR` 在 Redis 内是原子操作，同一时刻多个请求不会拿到相同的序号
  // - 当天首次生成时给 key 设置过期时间到当天结束，避免长期堆积
  const currentValue = await redisClient.incr(redisKey);
  if (currentValue === 1) {
    const exat = dayjs().endOf("day");
    await redisClient.expireAt(redisKey, exat.unix());
  }

  return {
    serviceCode: head + currentValue.toString().padStart(3, "0"),
    previousValue: currentValue > 1 ? currentValue - 1 : null,
  };
}
