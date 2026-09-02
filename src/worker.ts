import prisma from "./utils/prisma";
import { sendEmail, mailFrom } from "./utils/mailer";
import {
  applicantExchange,
  applicationApproveQueue,
  applicationApproveRoutingKey,
} from "./config/rabbitmq";
import { getConnection } from "./utils/rabbitmq";
import { logger } from "./utils/logger";

// worker 容器：仅做 RabbitMQ 邮件消费
// 与 server 容器共用同一镜像，仅启动命令不同（见 deploy/docker-compose.yml）

async function startWorker() {
  // 复用进程级共享连接（带断线自动重建）；worker 需要自建 channel 以便 prefetch/consume
  const conn = await getConnection();
  const channel = await conn.createChannel();
  await channel.assertExchange(applicantExchange, "topic", {
    durable: true,
  });
  // 声明队列并绑定到 exchange 的 routing key，保证队列存在且能收到消息
  await channel.assertQueue(applicationApproveQueue, { durable: true });
  await channel.bindQueue(
    applicationApproveQueue,
    applicantExchange,
    applicationApproveRoutingKey,
  );

  await channel.prefetch(1); // 一次只处理一条，处理完 ack 后再取
  await channel.consume(applicationApproveQueue, async (msg) => {
    if (!msg) return;
    const deliveryTag = msg.fields.deliveryTag;
    let parsed: any;
    try {
      const value = msg.content.toString();
      console.log("[worker] Received message:", value);
      try {
        parsed = JSON.parse(value);
      } catch {
        throw new Error("消息格式错误：非 JSON");
      }
      if (!parsed?.mailId) throw new Error("消息缺少 mailId");

      const mail = await prisma.mail.findUnique({ where: { id: parsed.mailId } });
      if (!mail) throw new Error(`邮件记录不存在: ${parsed.mailId}`);
      if (!mail.to || !mail.from || !mail.content || !mail.title) {
        throw new Error(`邮件信息不完整: id=${mail.id}`);
      }

      await sendEmail(mail.to, mail.title, mail.content);
      await prisma.mail.update({
        where: { id: parsed.mailId },
        data: { sendAt: new Date() },
      });
      console.log(`[worker] 邮件发送成功: id=${mail.id}, to=${mail.to}`);
      channel.ack(msg); // 成功确认
    } catch (err: any) {
      // 消费失败：累加 failCount（注意原代码漏了 await，这里补上避免未捕获的 Promise）
      if (typeof parsed?.mailId === "number" && !isNaN(parsed.mailId)) {
        await prisma.mail.update({
          where: { id: parsed.mailId },
          data: { failCount: { increment: 1 } },
        });
      }

      console.error("[worker] 消费失败:", err?.message);
      // 失败后 requeue，让消息重新入队等待重试
      channel.nack(deliveryTag, false, true);
    }
  });

  logger.info({ msg: "RabbitMQ 消费者已启动" });
}

await startWorker();
