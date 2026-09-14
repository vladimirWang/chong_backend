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
} from "./config/rabbitmq";
import { getRabbitChannel } from "./utils/rabbitmq";
import { sendEmail } from "./utils/mailer";
import prisma from "./utils/prisma";

async function startWorker() {
  const channel = await getRabbitChannel();
  await channel.assertExchange(applicantExchange, "topic", { durable: true });
  await channel.assertQueue(applicationApproveQueue, { durable: true });
  await channel.bindQueue(
    applicationApproveQueue,
    applicantExchange,
    applicationApproveRoutingKey,
  );

  // 一次只处理一条，处理完 ack 后再取
  await channel.prefetch(1);
  await channel.consume(applicationApproveQueue, async (msg) => {
    if (!msg) return;
    try {
      const value = msg.content.toString();
      console.log("[worker] 收到消息:", value);

      let parsed: { mailId?: number };
      try {
        parsed = JSON.parse(value);
      } catch {
        throw new Error("消息格式错误：非 JSON");
      }
      if (!parsed?.mailId) throw new Error("消息缺少 mailId");

      const mail = await prisma.mail.findUnique({
        where: { id: parsed.mailId },
      });
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
      channel.ack(msg);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[worker] 消费失败:", errMsg);
      // 尝试递增 failCount（parsed 可能未定义，需二次解析）
      try {
        const parsed = JSON.parse(msg.content.toString());
        if (parsed?.mailId) {
          await prisma.mail.update({
            where: { id: parsed.mailId },
            data: { failCount: { increment: 1 } },
          });
        }
      } catch {
        // JSON 解析失败或 DB 更新失败，忽略
      }
      // requeue 重试
      channel.nack(msg, false, true);
    }
  });

  console.log("[worker] 邮件消费者已启动，等待消息...");
}

startWorker().catch((err) => {
  console.error("[worker] 启动失败:", err);
  process.exit(1);
});
