import type { Context } from "elysia";
import { sendEmail } from "../utils/mailer";
import { SuccessResponse, ErrorResponse, errorCode } from "../models/Response";
import { redisClient } from "../utils/redis";
import {
  SendVerification,
  CheckEmailValidation,
} from "../validators/utilValidator";
import logger from "../utils/logger";
import { v4 as uuidv4 } from "uuid";
import svgCaptcha from "svg-captcha";
import { generateNonce } from "../utils/algo";

export const emailVerificationTag = "register:emailVerification";
export const sendEmailVerificationCode = async ({
  body,
}: {
  body: SendVerification;
}) => {
  const redisKey = `${emailVerificationTag}:${body.email}`;
  // 如果有还未过期的验证码，先删除
  await redisClient.del(redisKey);
  const rnd = Math.random();
  const verificationCode = (rnd + "").slice(2, 6);
  const info = await sendEmail(
    body.email,
    "仓库系统邮箱验证",
    `仓库系统邮箱验证码: ${verificationCode}`, // Plain-text version of the message
    `<b>验证码是： ${verificationCode}</b>`, // HTML version of the message
  );
  await redisClient.setEx(redisKey, 10 * 60, verificationCode);
  console.log("--------邮箱验证码----------: ", verificationCode);
  return new SuccessResponse(null, "邮件发送成功");
};

// 校验邮箱是否有效
export const checkEmailValidation = async ({
  body,
}: {
  body: CheckEmailValidation;
}) => {
  const { verifyCode, email } = body;

  const redisKey = `${emailVerificationTag}:${email}`;
  const storedVerifyCode = await redisClient.get(redisKey);
  if (storedVerifyCode !== verifyCode) {
    return new SuccessResponse({ email, verified: false }, "邮箱验证失败");
  }
  // await redisClient.del(redisKey);

  return new SuccessResponse({ email, verified: true }, "邮件验证通过");
};

export const generateCaptcha = async ({ set }: Pick<Context, "set">) => {
  const captcha = svgCaptcha.create({
    size: 4, // 验证码长度
    fontSize: 50,
    ignoreChars: "0o1i", // 忽略的字符
    noise: 3,
    width: 100,
    height: 40,
  });
  const captchaId = uuidv4();
  const captchaText = captcha.text.toLowerCase();

  await redisClient.setEx(
    `captcha:login:${captchaId}`,
    5 * 60, // 5分钟
    captchaText,
  );
  // const clientIp = request.headers.get("x-forwarded-for") || request.ip;
  // const freqKey = `captcha:freq:${clientIp}`;
  logger.info({ msg: "图形验证码", captchaText, captchaId });
  // 将 SVG 转为 base64，方便前端直接用于 img src
  const base64 = Buffer.from(captcha.data, "utf-8").toString("base64");
  const dataUrl = `data:image/svg+xml;base64,${base64}`;
  set.headers["Content-Type"] = "application/json";
  return new SuccessResponse<{ image: string; captchaId: string }>(
    { image: dataUrl, captchaId },
    "验证码生成成功",
  );
};

// 获取一次性nonce
export const getNonce = async () => {
  const nonce = generateNonce();
  return new SuccessResponse(nonce, "nonce生成成功");
};
