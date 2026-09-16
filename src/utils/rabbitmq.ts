import amqp from "amqplib";
import { createModuleLogger } from "./logger";

const logger = createModuleLogger("rabbitmq");

// 用返回值推断类型，避免依赖 @types/amqplib 不同版本间的类型改名（Connection/Channel）
type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;
type AmqpChannel = Awaited<
  ReturnType<AmqpConnection["createChannel"]>
>;

// 进程级共享连接与通道：DNS 解析 + 建连只发生一次，断线后下次调用自动懒重建
let connPromise: Promise<AmqpConnection> | null = null;
let channelPromise: Promise<AmqpChannel> | null = null;

function getConnection(): Promise<AmqpConnection> {
  if (!connPromise) {
    connPromise = amqp
      .connect(process.env.RABBITMQ_URL!)
      .then((conn) => {
        logger.info("连接成功");
        conn.on("close", resetAll);
        conn.on("error", (err) => {
          logger.error("connection error", { error: err?.message });
          resetAll();
        });
        return conn;
      })
      .catch((err) => {
        logger.error("连接失败", { error: err?.message });
        resetAll();
        return Promise.reject(err);
      });
  }
  return connPromise;
}

export function getRabbitChannel(): Promise<AmqpChannel> {
  if (!channelPromise) {
    channelPromise = getConnection()
      .then(async (conn) => {
        const channel = await conn.createChannel();
        channel.on("close", () => {
          channelPromise = null;
        });
        channel.on("error", (err) => {
          logger.error("channel error", { error: err?.message });
          channelPromise = null;
        });
        return channel;
      })
      .catch((err) => {
        channelPromise = null;
        return Promise.reject(err);
      });
  }
  return channelPromise;
}

function resetAll() {
  connPromise = null;
  channelPromise = null;
}
