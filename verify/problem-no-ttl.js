// verify/problem-no-ttl.js
// 剩余问题 ①：INCR 成功、EXPIRE 未执行 → 计数键无 TTL，计数永不衰减
//
// 复现思路：无法从 API 层注入"INCR 之后进程崩溃"，所以直接构造该崩溃的终态
// （一个无 TTL、残留值为 5 的计数键），再观察它对下一次登录的影响。
//
// 运行：bun verify/problem-no-ttl.js
// 前提：后端已用 .env.devLocal 启动（API=4000，Redis=127.0.0.1:16379）
// 可用环境变量覆盖：API / EMAIL / REDIS_HOST / REDIS_PORT

import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

const BASE = process.env.API ?? "http://localhost:4000";
const EMAIL = process.env.EMAIL ?? "fernandowang584@gmail.com";
const WRONG = process.env.WRONG ?? "definitely-wrong-password";
const REDIS_HOST = process.env.REDIS_HOST ?? "127.0.0.1";
const REDIS_PORT = process.env.REDIS_PORT ?? "16379";
const COUNT_OF_PASSWORD_WRONG = 6;

const FAILED_KEY = `adminLogin:failed:${EMAIL}`;
const LOCKED_KEY = `adminLogin:locked:${EMAIL}`;

const redisCli = (...args) =>
  execSync(`redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} ${args.join(" ")}`).toString().trim();
const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");

async function prepareLogin() {
  const nonce = (await (await fetch(`${BASE}/nodejs_api/util/get-nonce`)).json()).data;
  const cap = (await (await fetch(`${BASE}/nodejs_api/util/captcha`)).json()).data;
  const salt = (await (await fetch(`${BASE}/nodejs_api/admin/user/getSalt/${EMAIL}`)).json()).data;
  const captchaText = redisCli("get", `captcha:login:${cap.captchaId}`);
  if (!captchaText) {
    throw new Error(`读不到 captcha:login:${cap.captchaId}，请确认后端连接的是 ${REDIS_HOST}:${REDIS_PORT}`);
  }
  const password = sha256(`${sha256(`${WRONG}_${salt}`)}_${nonce}`);
  return { email: EMAIL, password, nonce, captchaId: cap.captchaId, captchaText };
}

async function login(body) {
  const res = await fetch(`${BASE}/nodejs_api/admin/user/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

const resetKeys = () => redisCli("del", FAILED_KEY, LOCKED_KEY);

async function main() {
  resetKeys();

  console.log("① 构造崩溃终态：计数已被 INCR 推到 5，但 EXPIRE 没有执行");
  redisCli("set", FAILED_KEY, "5"); // SET 不带 TTL，等价于"INCR 创建了键、EXPIRE 没落地"
  console.log(`   ${FAILED_KEY} = 5, TTL = ${redisCli("ttl", FAILED_KEY)}   (-1 表示永不过期)`);
  console.log("   正常固定窗口下，这个 5 应在 1 小时后随键一起消失；失去 TTL 后它可以跨天存在\n");

  const body = await prepareLogin();
  const res = await login(body);
  console.log(`② 用户"只再错一次" → code=${res.code}（10008=密码错误 / 10010=已锁定）`);
  console.log(
    `   count = ${redisCli("get", FAILED_KEY)}, locked = ${redisCli("exists", LOCKED_KEY)}, TTL = ${redisCli("ttl", FAILED_KEY)}`,
  );
  console.log(`   结论：残留 5 + 本次 INCR = 6 → 命中 >= ${COUNT_OF_PASSWORD_WRONG} → 立即锁定`);
  console.log("   注意：这次 TTL 被 ttl<0 兜底补上了（兜底有效），但 INCR 与 TTL/EXPIRE 之间仍是非原子窗口\n");

  // resetKeys();
  // console.log("已清理测试 key");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
