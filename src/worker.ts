/**
 * RabbitMQ 邮件发送消费者（移植自旧 Elysia worker.ts）
 *
 * 消费 application.approve 队列消息 → 查 Mail 记录 → SMTP 发信 → 标记 sendAt
 * 失败递增 failCount 并 nack requeue 重试
 *
 * 启动：bun run src/worker.ts（docker-compose 中 worker 服务已配置）
 */
import {
  applicantExchange,
  applicationApproveQueue,
  applicationApproveRoutingKey,
  applicationApproveDlx,
  applicationApproveDlq,
  MAX_RETRY,
} from "./config/rabbitmq";
import { getRabbitChannel } from "./utils/rabbitmq";
import { mailer, sendEmail } from "./utils/mailer";
import prisma from "./utils/prisma";
import { createModuleLogger } from "./utils/logger";

const logger = createModuleLogger("worker", process.env.WORKER_LOG_DIR);

sendEmail('184594923@qq.com', '仓库测试邮件', '这是一封测试邮件').then(() => {
  console.log("邮件发送成功");
}).catch((err) => {
  console.error("邮件发送失败:", err);
});

async function startWorker() {
  // ① 启动阶段唯一一次 SMTP 校验（握手 + 认证，不发邮件）。
  // 只在进程启动时执行一次；后续无论消费成功/失败、消息如何 requeue，
  // 都不会再次触发 verify，避免高频认证被邮箱服务商限流。
  try {
    await mailer.verify();
    logger.info("SMTP 连接验证通过");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`SMTP 连接验证失败，worker 无法启动: ${msg}`);
  }

  // ② 建立 RabbitMQ 拓扑
  const channel = await getRabbitChannel();

  // 死信交换机（fanout）+ 死信队列：只声明不消费，消息进入后隔离保存
  await channel.assertExchange(applicationApproveDlx, "fanout", { durable: true });
  await channel.assertQueue(applicationApproveDlq, { durable: true });
  await channel.bindQueue(applicationApproveDlq, applicationApproveDlx, "");

  await channel.assertExchange(applicantExchange, "topic", { durable: true });
  // 业务队列绑定死信交换机：nack(requeue=false) 的消息由 broker 自动转发进 DLQ
  // 注意：RabbitMQ 不允许修改已存在队列的 arguments，改此参数需先删除旧队列
  await channel.assertQueue(applicationApproveQueue, {
    durable: true,
    deadLetterExchange: applicationApproveDlx,
  });
  await channel.bindQueue(
    applicationApproveQueue,
    applicantExchange,
    applicationApproveRoutingKey,
  );

  // 一次只处理一条，处理完 ack 后再取
  await channel.prefetch(1);

  // ③ 消费回调：注意这里面绝不调用 mailer.verify()
  await channel.consume(applicationApproveQueue, async (msg) => {
    if (!msg) return;
    // 提到 try 外：catch 分流时需要用到（解析失败/记录不存在时保持 undefined/0）
    let mailId: number | undefined;
    let previousFailCount = 0;
    try {
      const value = msg.content.toString();
      logger.info("收到消息", { body: value });

      let parsed: { mailId?: number };
      try {
        parsed = JSON.parse(value);
      } catch {
        throw new Error("消息格式错误：非 JSON");
      }
      if (!parsed?.mailId) throw new Error("消息缺少 mailId");
      mailId = parsed.mailId;

      const mail = await prisma.mail.findUnique({
        where: { id: mailId },
      });
      if (!mail) throw new Error(`邮件记录不存在: ${mailId}`);
      if (!mail.to || !mail.from || !mail.content || !mail.title) {
        throw new Error(`邮件信息不完整: id=${mail.id}`);
      }
      previousFailCount = mail.failCount ?? 0;

      // 直接发信，复用启动时已验证的连接，不再 verify
      await sendEmail(mail.to, mail.title, mail.content);
      await prisma.mail.update({
        where: { id: mailId },
        data: { sendAt: new Date() },
      });
      logger.info(`邮件发送成功: id=${mail.id}, to=${mail.to}`);
      channel.ack(msg);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error("消费失败", { error: errMsg });

      // 递增 failCount（JSON 解析失败等拿不到 mailId 时跳过）
      let nextFailCount = previousFailCount;
      if (mailId) {
        try {
          const updated = await prisma.mail.update({
            where: { id: mailId },
            data: { failCount: { increment: 1 } },
            select: { failCount: true },
          });
          nextFailCount = updated.failCount ?? previousFailCount + 1;
        } catch {
          // DB 更新失败：用内存中的估算值继续做分流判断
          nextFailCount = previousFailCount + 1;
        }
      }

      // 分流规则：
      // 1) 不可重试错误（消息体/数据问题）→ 立即进死信队列
      // 2) 可重试错误但失败次数已达上限 → 进死信队列
      // 3) 其余可重试错误 → nack requeue 继续重试
      const NON_RETRIABLE = [
        "消息格式错误",
        "消息缺少 mailId",
        "邮件记录不存在",
        "邮件信息不完整",
      ];
      const nonRetriable = NON_RETRIABLE.some((p) => errMsg.includes(p));
      const exceededMaxRetry = nextFailCount >= MAX_RETRY;

      if (nonRetriable || exceededMaxRetry) {
        const reason = nonRetriable ? "不可重试错误" : `重试次数已达上限(${MAX_RETRY})`;
        logger.warn(
          `消息进入死信队列: mailId=${mailId}, failCount=${nextFailCount}, reason=${reason}, error=${errMsg}`,
        );
        // requeue=false：broker 依据队列的 deadLetterExchange 参数自动转发到 DLQ
        channel.nack(msg, false, false);
      } else {
        channel.nack(msg, false, true);
      }
    }
  });

  logger.info("邮件消费者已启动，等待消息...");
}

startWorker().catch((err) => {
  logger.error(
    `启动失败: ${err instanceof Error ? err.stack ?? err.message : String(err)}`,
  );
  process.exit(1);
});
