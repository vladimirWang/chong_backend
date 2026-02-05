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
    return new ErrorResponse(errorCode.CAPTCHA_EXPIRED, "验证码已过期")
  }
  // redis中存的验证码与用户提交的验证码不一致
  if (storedCaptcha.toLowerCase() !== body.captchaText.toLowerCase()) {
      return new ErrorResponse(errorCode.CAPTCHA_INCORRECT, "验证码不正确")
  }
  // 如果验证码校验通过就在redis中删除
  await redisClient.del(redisKey);
  const userExisted = await prisma.user.findFirst({
    where: {
      email: body.email,
    },
  });

  if (!userExisted) {
    // 记录
    const result = new ErrorResponse(errorCode.USER_NOT_FOUND, "用户不存在");
    return result;
  }
  
  // 当前账号是否冻结
  const ACCOUNT_LOCKED_KEY = 'login:locked:' + body.email
  const lockStatus = await redisClient.get(ACCOUNT_LOCKED_KEY)
  console.log('lockStatus: ', lockStatus)
  if (lockStatus) {
    const result = new ErrorResponse(errorCode.ACCOUNT_LOCKED, "账号已锁定");
    return result;
  }
  // 密码错误次数的key
  const loginFailedKey = `login:failed:${body.email}`;
  // 如果密码不对就记录次数
  if (userExisted.password !== body.password) {
    // 一小时
    const FREEZE_DURATION = 60*60

    // 登录失败次数
    const loginFailedCount = await redisClient.get(loginFailedKey);
    if (loginFailedCount) {
      await redisClient.incr(loginFailedKey);
      await redisClient.expire(loginFailedKey, FREEZE_DURATION);
      // 密码最多错误次数
      const COUNT_OF_PASSWORD_WRONG = 6
      console.log("loginFailedCount: ", loginFailedCount)
      if (Number(loginFailedCount) === COUNT_OF_PASSWORD_WRONG - 1) {
        await redisClient.setEx(ACCOUNT_LOCKED_KEY, FREEZE_DURATION, "1")
      }
    } else {
      await redisClient.setEx(loginFailedKey, FREEZE_DURATION, "1");
    }
    const result = new ErrorResponse(
      errorCode.PASSWORD_INCORRECT,
      "密码不正确"
    );
    return result;
  }
  // 如果密码正确，就清空密码错误次数
  await redisClient.del(loginFailedKey)
  // 生成 token
  const token = await jwt.sign({
    userId: userExisted.id,
    email: userExisted.email,
  });

  return new SuccessResponse<string>(token, "用户登录成功");
};

export const generateCaptcha = async ({ set, request }) => {
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
    captchaText
  );
  // const clientIp = request.headers.get("x-forwarded-for") || request.ip;
  // const freqKey = `captcha:freq:${clientIp}`;
  console.log(
    "--------图形验证码----------: ",
    captchaText
  );
  // 将 SVG 转为 base64，方便前端直接用于 img src
  const base64 = Buffer.from(captcha.data, "utf-8").toString("base64");
  const dataUrl = `data:image/svg+xml;base64,${base64}`;
  set.headers["Content-Type"] = "application/json";
   return  new SuccessResponse<{ image: string }>(
      { image: dataUrl, captchaId },
      "验证码生成成功"
    )
};

export const registerUser = async ({ body }: { body: RegisterUserBody }) => {
  // console.log("register body: ", prisma.user)
  // return {code: '1'}
  const {username, email, password} = body;
  const user = await prisma.user.create({
    data: {
      email,
      password,
      username
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
  return result;
};
