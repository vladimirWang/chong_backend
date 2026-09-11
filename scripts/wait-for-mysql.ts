/**
 * 容器启动时 MySQL 可能尚未在宿主机网络/DNS 上完全就绪，Prisma 会直接报 P1001。
 * 在 migrate / seed 前先等到 TCP 可连（与 DATABASE_HOST / DATABASE_URL 一致）。
 */
import net from "node:net";

function resolveEndpoint(): { host: string; port: number } {
  if (process.env.DATABASE_HOST) {
    return {
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT || "3306"),
    };
  }
  const url = process.env.DATABASE_URL;
  if (url) {
    const m = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (m) {
      return { host: m[3], port: parseInt(m[4], 10) };
    }
  }
  return { host: "mysql", port: 3306 };
}

function tryTcp(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve(ok);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(3000, () => done(false));
  });
}

async function main() {
  const { host, port } = resolveEndpoint();
  const maxAttempts = Number(process.env.WAIT_FOR_MYSQL_ATTEMPTS || "60");
  const delayMs = Number(process.env.WAIT_FOR_MYSQL_DELAY_MS || "2000");

  for (let i = 0; i < maxAttempts; i++) {
    if (await tryTcp(host, port)) {
      console.log(`MySQL TCP ready at ${host}:${port}`);
      return;
    }
    console.log(
      `Waiting for MySQL ${host}:${port} (attempt ${i + 1}/${maxAttempts})...`,
    );
    await new Promise((r) => setTimeout(r, delayMs));
  }

  console.error(
    `MySQL not reachable at ${host}:${port} after ${maxAttempts} attempts (P1001).`,
  );
  process.exit(1);
}

await main();
