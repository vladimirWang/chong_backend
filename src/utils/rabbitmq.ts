import amqp from "amqplib";
import { logger } from "./logger";

// 用返回值推断类型，避免依赖 @types/amqplib 不同版本间的类型改名（Connection/ChannelModel）
type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection["createChannel"]>>;

// 进程级共享连接与通道：DNS 解析 + 建连只发生一次，断线后下次调用自动重建
let connPromise: Promise<AmqpConnection> | null = null;
let channelPromise: Promise<AmqpChannel> | null = null;

function resetAll() {
  connPromise = null;
  channelPromise = null;
}

// worker 等需要自建 channel 的场景用此方法；普通 publish 走 getRabbitChannel 即可
export function getConnection(): Promise<AmqpConnection> {
  if (!connPromise) {
    connPromise = amqp
      .connect(process.env.RABBITMQ_URL!)
      .then((conn) => {
        logger.info({ msg: "RabbitMQ 连接成功" });
        // 断开/出错时重置缓存，下次 publish 时懒重建
        conn.on("close", resetAll);
        conn.on("error", (err) => {
          logger.error({ err: err?.message }, "RabbitMQ connection error");
          resetAll();
        });
        return conn;
      })
      .catch((err) => {
        logger.error({ err: err?.message }, "RabbitMQ 连接失败");
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
          logger.error({ err: err?.message }, "RabbitMQ channel error");
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
