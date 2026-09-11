import type { Context } from "hono";
import svgCaptcha from "svg-captcha";
import { SuccessResponse } from "../../models/Response";
import { generateNonce } from "../../utils/algo";
import { redisClient } from "../../utils/redis";

/**
 * 获取一次性 nonce（实现函数在 src/utils/algo.ts，与老架构一致）
 */
export const getNonceHandler = (c: Context) =>
  c.json(new SuccessResponse(generateNonce(), "nonce生成成功"));

/**
 * 生成图形验证码（移植自 repo_backend generateCaptcha）
 * SVG → base64 dataURL，答案存 redis 5 分钟（captcha:login:{captchaId}），供登录校验消费
 */
export const generateCaptchaHandler = async (c: Context) => {
  const captcha = svgCaptcha.create({
    size: 4, // 验证码长度
    fontSize: 50,
    ignoreChars: "0o1i", // 忽易混淆字符
    noise: 3,
    width: 100,
    height: 40,
  });
  const captchaId = crypto.randomUUID();
  const captchaText = captcha.text.toLowerCase();

  await redisClient.setEx(`captcha:login:${captchaId}`, 5 * 60, captchaText);

  // SVG 转 base64，方便前端直接用于 img src
  const base64 = Buffer.from(captcha.data, "utf-8").toString("base64");
  const dataUrl = `data:image/svg+xml;base64,${base64}`;
  return c.json(
    new SuccessResponse<{ image: string; captchaId: string }>(
      { image: dataUrl, captchaId },
      "验证码生成成功",
    ),
  );
};
