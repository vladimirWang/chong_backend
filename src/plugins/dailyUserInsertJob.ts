import { Elysia } from "elysia";
import { cron } from "@elysiajs/cron";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import prisma from "../utils/prisma";
import { redisClient } from "../utils/redis";
import { logger } from "../utils/logger";

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_TZ = "Asia/Shanghai";

async function tryAcquireDailyLock(dateKey: string) {
  // 锁有效期给到 26 小时，覆盖时区/运行延迟/重启边界，避免同一天重复执行
  const lockTtlSeconds = 26 * 60 * 60;
  const lockKey = `cron:userInsert:${dateKey}`;
  const value = String(Date.now());

  // Redis v5: set(key, value, { NX: true, EX: seconds })
  const ok = await redisClient.set(lockKey, value, {
    NX: true,
    EX: lockTtlSeconds,
  });

  return ok === "OK";
}

async function insertDailyUser(tz: string) {
  const now = dayjs().tz(tz);
  const dateKey = now.format("YYYY-MM-DD");

  const acquired = await tryAcquireDailyLock(dateKey);
  if (!acquired) {
    logger.info({ msg: "定时任务跳过（已执行过）", dateKey });
    return;
  }

  const user = await prisma.user.create({
    data: {
      email: "hello@system.local",
      password: "12345678",
      username: "cron",
    },
  });

  logger.info(
    {
      msg: "定时任务插入 User 成功",
      dateKey,
      userId: user.id,
      email: user.email,
    },
    "cron job ok",
  );
}

export function createDailyUserInsertJob() {
  const tz = process.env.CRON_TZ || DEFAULT_TZ;
  const enabled = (process.env.ENABLE_CRON ?? "true").toLowerCase() === "true";
  const schedule = "08 16 * * *";

  if (!enabled) {
    return new Elysia({ name: "daily-user-insert-job" }).onStart(() => {
      logger.info({ msg: "定时任务已禁用", tz, schedule });
    });
  }

  return new Elysia({ name: "daily-user-insert-job" })
    .use(
      cron({
        name: "dailyUserInsert",
        pattern: schedule,
        timezone: tz,
        async run() {
          try {
            await insertDailyUser(tz);
          } catch (err: any) {
            logger.error(
              { err: err?.message, stack: err?.stack },
              "定时任务插入 User 失败",
            );
          }
        },
      }),
    )
    .onStart(() => {
      logger.info({ msg: "定时任务已注册", tz, schedule });
    });
}
