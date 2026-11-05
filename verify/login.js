// repro.mjs —— Node 20+ / Bun 均可
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

const BASE = process.env.API ?? "http://localhost:4000";
// const EMAIL = process.env.EMAIL;          // 已存在的管理员邮箱
const EMAIL = "fernandowang584@gmail.com";          // 已存在的管理员邮箱
const WRONG = "definitely-wrong-password"; // 故意用错密码
const REDIS_HOST = process.env.REDIS_HOST ?? "127.0.0.1";
const REDIS_PORT = process.env.REDIS_PORT ?? "16379";
const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");

// 读本地 redis 里的验证码答案，避免 OCR
const readCaptcha = (id) =>
  execSync(`redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} get captcha:login:${id}`)
    .toString()
    .trim();

async function prepare() {
  const nonce = (await (await fetch(`${BASE}/nodejs_api/util/get-nonce`)).json()).data;
  const cap = (await (await fetch(`${BASE}/nodejs_api/util/captcha`)).json()).data;
  const salt = (await (await fetch(`${BASE}/nodejs_api/admin/user/getSalt/${EMAIL}`)).json()).data;
  const hash1 = sha256(`${WRONG}_${salt}`);
  const password = sha256(`${hash1}_${nonce}`);
  return { email: EMAIL, password, nonce, captchaId: cap.captchaId, captchaText: readCaptcha(cap.captchaId) };
}

const login = (body) =>
  fetch(`${BASE}/nodejs_api/admin/user/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const N = Number(process.env.N ?? 2);
const bodies = await Promise.all(Array.from({ length: N }, prepare));
const results = await Promise.all(bodies.map(login));
const payloads = await Promise.all(results.map((r) => r.json()));
console.log(payloads.map((p) => p.code));