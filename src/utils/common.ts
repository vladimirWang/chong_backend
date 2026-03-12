import dayjs from "dayjs";
import { redisClient } from "./redis";

interface IGenerateServiceResult {
  serviceCode: string;
  previousValue: number;
}
// 生成进货单号
export async function generateServiceCode(
  serviceCode: string, // 服务单号前缀
  redisKeyPrefix: string, // 缓存key
): Promise<string> {
  const date = dayjs().format("YYMMDD");
  const redisKey = `${redisKeyPrefix}:${date}`;
  const redisValue = await redisClient.get(redisKey);
  const head = `${serviceCode}${date}`;
  const currentValue = parseInt(redisValue);
  if (redisValue && isNaN(currentValue)) {
    return Promise.reject(new Error("生成服务单号失败"));
  }
  return {
    serviceCode: head + (currentValue + 1).toString().padStart(3, "0"),
    previousValue: currentValue,
  };
}
