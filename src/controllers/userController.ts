import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import { LoginUserBody, RegisterUserBody } from "../validators/userValidator";
import prisma from "../utils/prisma";
import svgCaptcha from "svg-captcha";
import { redisClient } from "../utils/redis";
import { v4 as uuidv4 } from "uuid";

export const loginUser = async ({
  body,
  jwt,
}: {
  body: LoginUserBody;
  jwt: any;
}) => {
  const redisKey = `captcha:login:${body.captchaId}`;
  const storedCaptcha = await redisClient.get(redisKey);
  if (!storedCaptcha) {
    return JSON.stringify(
      new ErrorResponse(errorCode.CAPTCHA_EXPIRED, "验证码已过期"),
    );
  }
  if (storedCaptcha.toLowerCase() !== body.captchaText.toLowerCase()) {
    return JSON.stringify(
      new ErrorResponse(errorCode.CAPTCHA_INCORRECT, "验证码不正确"),
    );
  }
  await redisClient.del(redisKey);
  const userExisted = await prisma.user.findFirst({
    where: {
      email: body.email,
      password: body.password,
    },
  });
  if (!userExisted) {
    const result = new ErrorResponse(errorCode.USER_NOT_FOUND, "用户不存在");
    return JSON.stringify(result);
  }
  // 生成 token
  const token = await jwt.sign({
    userId: userExisted.id,
    email: userExisted.email,
  });

  return JSON.stringify(new SuccessResponse<string>(token, "用户登录成功"));
};

export const generateCaptcha = async ({ set, request }) => {
  const captcha = svgCaptcha.create({
    size: 4, // 验证码长度
    fontSize: 50,
    ignoreChars: "0o1i", // 忽略的字符
    noise: 3,
    width: 100,
    height: 30,
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
  // console.log(
  //   "--------freqKey----------: ",
  //   request.headers,
  //   freqKey,
  //   clientIp,
  //   request,
  // );
  // 将 SVG 转为 base64，方便前端直接用于 img src
  const base64 = Buffer.from(captcha.data, "utf-8").toString("base64");
  const dataUrl = `data:image/svg+xml;base64,${base64}`;
  set.headers["Content-Type"] = "application/json";
  return JSON.stringify(
    new SuccessResponse<{ image: string }>(
      { image: dataUrl, captchaId },
      "验证码生成成功",
    ),
  );
};

export const registerUser = async ({ body }: { body: RegisterUserBody }) => {
  // console.log("register body: ", prisma.user)
  // return {code: '1'}
  const user = await prisma.user.create({
    data: {
      email: body.email,
      password: body.password,
    },
    // select: [
    //     'id',
    //     "email",
    //     "username",
    //     "createdAt"
    // ]
  });

  const userCreated = {
    id: user.id,
    email: user.email,
    username: user.username,
    createdAt: user.createdAt,
  };
  const result = new SuccessResponse(userCreated, "用户创建成功");
  return JSON.stringify(result);
};
