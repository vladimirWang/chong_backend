// verify/problem-lock-write-gap.js
// 剩余问题 ②：INCR 已到阈值，但 SETEX 写锁前崩溃 → 该窗口内没有锁
//
// 复现思路：构造"第 6 次失败 INCR 成功、SETEX 未执行"的终态
// （count=6 且 locked 不存在），观察下一次失败能否补锁、攻击者多拿到几次尝试。
//
// 运行：bun verify/problem-lock-write-gap.js
// 前提：后端已用 .env.devLocal 启动（API=4000，Redis=127.0.0.1:16379）

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

  console.log("① 构造崩溃终态：第 6 次失败 INCR 成功（count=6），但 SETEX 锁没有执行");
  redisCli("setex", FAILED_KEY, "3600", String(COUNT_OF_PASSWORD_WRONG));
  console.log(`   count = ${redisCli("get", FAILED_KEY)}, locked = ${redisCli("exists", LOCKED_KEY)}   ← 已达阈值却没有锁`);
  console.log("   这一波攻击者已经用完 6 次机会，但账号仍处于「未锁定」状态\n");

  const body = await prepareLogin();
  const res = await login(body);
  console.log(`② 攻击者继续错一次 → code=${res.code}（10008=密码错误 / 10010=已锁定）`);
  console.log(`   count = ${redisCli("get", FAILED_KEY)}, locked = ${redisCli("exists", LOCKED_KEY)}`);
  console.log("   结论：>= 判定让下一次失败「补锁」，但这也意味着攻击者多拿到 1 次尝试（第 7 次才被拦）；");
  console.log("   若攻击者在此后停手，本窗口内锁永远不会出现\n");

  resetKeys();
  console.log("已清理测试 key");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
