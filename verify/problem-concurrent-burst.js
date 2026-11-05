// verify/problem-concurrent-burst.js
// 剩余问题 ③：锁检查（GET locked）在密码校验之前，且与计数/加锁非原子
//            → 同一波并发请求可以全部通过锁检查，超过阈值的尝试照样校验密码
//
// 运行：bun verify/problem-concurrent-burst.js
// 参数：N=每次并发的请求数（默认 10）、ROUNDS=轮数（默认 3）
// 前提：后端已用 .env.devLocal 启动（API=4000，Redis=127.0.0.1:16379）

import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

const BASE = process.env.API ?? "http://localhost:4000";
const EMAIL = process.env.EMAIL ?? "fernandowang584@gmail.com";
const WRONG = process.env.WRONG ?? "definitely-wrong-password";
const REDIS_HOST = process.env.REDIS_HOST ?? "127.0.0.1";
const REDIS_PORT = process.env.REDIS_PORT ?? "16379";
const COUNT_OF_PASSWORD_WRONG = 6;
const N = Number(process.env.N ?? 30);
const ROUNDS = Number(process.env.ROUNDS ?? 3);

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
  let maxWrong = 0;

  for (let round = 1; round <= ROUNDS; round++) {
    resetKeys();
    // 先把 N 组一次性凭证全部准备好，再同时发出，使它们尽量落在同一个"未锁定"窗口
    const bodies = await Promise.all(Array.from({ length: N }, prepareLogin));
    const results = await Promise.all(bodies.map(login));

    const wrong = results.filter((r) => r.code === 10008).length;
    const rejected = results.filter((r) => r.code === 10010).length;
    maxWrong = Math.max(maxWrong, wrong);

    console.log(`第 ${round} 轮：N=${N} 并发 → 密码错误 ${wrong} 个，锁定拒绝 ${rejected} 个，其他 ${N - wrong - rejected} 个`);
    console.log(`   count = ${redisCli("get", FAILED_KEY)}, locked = ${redisCli("exists", LOCKED_KEY)}`);
  }

  console.log("\n判断：");
  if (maxWrong > COUNT_OF_PASSWORD_WRONG) {
    console.log(`   ❌ 复现：同一波里有 ${maxWrong} 个请求执行了密码校验，超过阈值 ${COUNT_OF_PASSWORD_WRONG}`);
    console.log("      理想实现应在第 7 个起直接返回 10010（ACCOUNT_LOCKED），不进入密码校验");
  } else {
    console.log(`   ✅ 本轮最多只有 ${maxWrong} 个进入密码校验，未复现；可加大 N（如 N=20）或增加 ROUNDS`);
  }

  resetKeys();
  console.log("已清理测试 key");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
