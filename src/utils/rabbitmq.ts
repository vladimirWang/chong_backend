import amqp from "amqplib";

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
        console.log("[rabbitmq] 连接成功");
        conn.on("close", resetAll);
        conn.on("error", (err) => {
          console.error("[rabbitmq] connection error:", err?.message);
          resetAll();
        });
        return conn;
      })
      .catch((err) => {
        console.error("[rabbitmq] 连接失败:", err?.message);
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
          console.error("[rabbitmq] channel error:", err?.message);
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
