import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import {
  LoginUserBody,
  RegisterUserBody,
  UploadFileBody,
  ChangePasswordBody
} from "../validators/userValidator";
import prisma from "../utils/prisma";
import svgCaptcha from "svg-captcha";
import { redisClient } from "../utils/redis";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger";
import { sanitizeFilename, UPLOAD_DIR } from "../utils/file";
import path from "node:path";
import fs from "node:fs";
import { ParamEmail } from "../validators/commonValidator";
import { emailVerificationTag } from "./utilController";
import {
  generateFixedSalt,
  generateNonce,
  sha256,
  isValidNonce,
} from "../utils/algo";
import { sendEmail } from "../utils/mailer";

// 获取一次性nonce
export const getNonce = async () => {
  const nonce = generateNonce();
  return new SuccessResponse(nonce, "nonce生成成功");
};

export const loginUser = async ({
  body,
  jwt,
  status,
}: {
  body: LoginUserBody;
  jwt: any;
}) => {
  console.log("0000---status----1111: ", status);
  const isValid = await isValidNonce(body.nonce);
  if (!isValid) {
    return new ErrorResponse(errorCode.NONCE_INVALID, "nonce无效");
  }
  const redisKey = `captcha:login:${body.captchaId}`;
  const storedCaptcha = await redisClient.get(redisKey);
  if (!storedCaptcha) {
    return new ErrorResponse(errorCode.CAPTCHA_EXPIRED, "验证码已过期");
  }
  // redis中存的验证码与用户提交的验证码不一致
  if (storedCaptcha.toLowerCase() !== body.captchaText.toLowerCase()) {
    return new ErrorResponse(errorCode.CAPTCHA_INCORRECT, "验证码不正确");
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
  const ACCOUNT_LOCKED_KEY = "login:locked:" + body.email;
  const lockStatus = await redisClient.get(ACCOUNT_LOCKED_KEY);
  if (lockStatus) {
    const result = new ErrorResponse(errorCode.ACCOUNT_LOCKED, "账号已锁定");
    return result;
  }
  // 密码错误次数的key
  const loginFailedKey = `login:failed:${body.email}`;
  // const calculatedPassword = sha256(userExisted.password + "_" + body.nonce);
  // const passwordHash = sha256(body.password + "_" + userExisted.salt);
  const calculatedPassword = sha256(userExisted.password + "_" + body.nonce);
  console.log("calculatedPassword: ", calculatedPassword);
  console.log("body.password: ", body.password);
  console.log("body.nonce: ", body.nonce);
  // 如果密码不对就记录次数
  if (calculatedPassword !== body.password) {
    // 一小时
    const FREEZE_DURATION = 60 * 60;

    // 登录失败次数
    const loginFailedCount = await redisClient.get(loginFailedKey);
    if (loginFailedCount) {
      await redisClient.incr(loginFailedKey);
      await redisClient.expire(loginFailedKey, FREEZE_DURATION);
      // 密码最多错误次数
      const COUNT_OF_PASSWORD_WRONG = 6;
      console.log("loginFailedCount: ", loginFailedCount);
      if (Number(loginFailedCount) === COUNT_OF_PASSWORD_WRONG - 1) {
        await redisClient.setEx(ACCOUNT_LOCKED_KEY, FREEZE_DURATION, "1");
      }
    } else {
      await redisClient.setEx(loginFailedKey, FREEZE_DURATION, "1");
    }
    const result = new ErrorResponse(
      errorCode.PASSWORD_INCORRECT,
      "密码不正确",
    );
    return result;
  }
  // 如果密码正确，就清空密码错误次数
  await redisClient.del(loginFailedKey);

  // 生成 token（@elysiajs/jwt 的 sign 只接收一个 payload，exp 需写在 payload 里才会生效）
  const payload = {
    userId: userExisted.id,
    email: userExisted.email,
    username: userExisted.username,
    exp: "1d",
  };
  const token = await jwt.sign(payload);

  // 把token保存到redis中，有效期1天
  await redisClient.setEx(
    `token:${token}`,
    60 * 60 * 24,
    JSON.stringify(payload),
  );

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
    captchaText,
  );
  // const clientIp = request.headers.get("x-forwarded-for") || request.ip;
  // const freqKey = `captcha:freq:${clientIp}`;
  logger.info({ msg: "图形验证码", captchaText, captchaId });
  // 将 SVG 转为 base64，方便前端直接用于 img src
  const base64 = Buffer.from(captcha.data, "utf-8").toString("base64");
  const dataUrl = `data:image/svg+xml;base64,${base64}`;
  set.headers["Content-Type"] = "application/json";
  return new SuccessResponse<{ image: string }>(
    { image: dataUrl, captchaId },
    "验证码生成成功",
  );
};

export const registerUser = async ({ body }: { body: RegisterUserBody }) => {
  // console.log("register body: ", prisma.user)
  //
  const { username, email, password, verifyCode } = body;

  // redis查邮箱和验证码是否匹配
  // const redisKey = `email:verify:${email}`;
  const verifyCodeRedisKey = `${emailVerificationTag}:${email}`;
  const verifiCodeInRedis = await redisClient.get(verifyCodeRedisKey);
  console.log("verifiCodeInRedis: ", verifiCodeInRedis);
  console.log("verifyCode: ", verifyCode);
  if (verifiCodeInRedis !== verifyCode) {
    return new ErrorResponse(errorCode.EMAIL_VALIDATION_FAIL, "邮箱验证失败1");
  }

  await redisClient.del(verifyCodeRedisKey);

  const salt = generateFixedSalt();

  const passwordHash = sha256(password + "_" + salt);

  // return new SuccessResponse(salt, "盐生成成功");

  const user = await prisma.user.create({
    data: {
      email,
      password: passwordHash,
      username,
      salt,
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

export const logoutUser = async ({ headers }) => {
  const { authorization } = headers;
  await redisClient.del(`token:${authorization}`);
  return new SuccessResponse(null, "用户登出成功");
};

export const uploadFile = async ({ body }: { body: UploadFileBody }) => {
  const { hash, file } = body;

  const { ext } = sanitizeFilename(file.name);
  const storageFileName = uuidv4() + ext;

  console.log(
    "---uploadFile---: ",
    UPLOAD_DIR,
    hash,
    file.name,
    ext,
    storageFileName,
  );

  const savePath = path.join(UPLOAD_DIR, storageFileName);

  await Bun.write(savePath, file);

  await prisma.fileInfo.create({
    data: {
      hash,
      filePath: path.join("/public/uploads", storageFileName),
    },
  });
  return new SuccessResponse(
    {
      filePath: path.join("/public/uploads", storageFileName),
      baseUrl: process.env.PUBLIC_BASE_URL,
    },
    "文件保存成功",
  );
};

export const checkFileExistedByHash = async ({
  params,
}: {
  params: { hash: string };
}) => {
  const { hash } = params;
  const fileInfo = await prisma.fileInfo.findFirst({
    where: {
      hash,
    },
  });
  if (fileInfo) {
    return new SuccessResponse(
      {
        filePath: fileInfo.filePath,
        baseUrl: process.env.PUBLIC_BASE_URL,
      },
      "文件已存在1",
    );
  } else {
    return new SuccessResponse(
      {
        filePath: "",
        baseUrl: process.env.PUBLIC_BASE_URL,
      },
      "文件不存在2",
    );
  }
};

export const checkEmailExisted = async ({ params }: { params: ParamEmail }) => {
  const { email } = params;
  const user = await prisma.user.findFirst({
    where: {
      email,
    },
  });
  return new SuccessResponse(!!user, "邮箱已存在");
};

export const getUserSaltByEmail = async ({
  params,
}: {
  params: ParamEmail;
}) => {
  const { email } = params;
  // 仅查询salt字段，最小权限原则
  const user = await prisma.user.findFirst({
    where: { email },
    select: { salt: true },
  });
  if (!user) {
    return new ErrorResponse(errorCode.USER_NOT_FOUND, "用户不存在");
  }
  return new SuccessResponse(user.salt, "获取salt成功");
};

export const changePassword = async (context: { body: ChangePasswordBody }) => {
  const { body, user } = context
  console.log("changePassword user: ", user);
  // const { email, current, password } = body;
  // const user = await prisma.user.findFirst({
  //   where: { email },
  // });
  // if (!user) {
  //   return new ErrorResponse(errorCode.USER_NOT_FOUND, "用户不存在");
  // }
  return new SuccessResponse(null, "密码修改成功");
};

// generate initial password: include number and letter
function generateInitialPassword(length: number = 8) {
  // const numbers = '0123456789';
  // const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (length <= 0) {
    throw new Error("length must be greater than 0");
  }
  let result = ''
  while(result.length < length) {
    const password = Math.random().toString(36).substring(2, 12)
    result+=password
  }
  return result.slice(0, length)
}

export const resetPassword = async({body}: {body: ParamEmail}) => {
  // const { email, password } = body;
  const userMatched = await prisma.user.findFirst({
    where: {
      email: body.email
    }
  })
  // // console.log("resetPassword user: ", userMathced);
  const initialPassword = generateInitialPassword(6);
  // // console.log("resetPassword user: ", user, initialPassword);

  const passwordHash = sha256(initialPassword + "_" + userMatched.salt);
  await prisma.user.update({
    where: {
      id: userMatched.id
    },
    data: {
      password: passwordHash
    }
  })
  // console.log("resetPassword user: ", user.userId, passwordHash, initialPassword);
  await sendEmail(userMatched.email, "密码重置成功", `您的初始密码为：${initialPassword}`);
  return new SuccessResponse(null, "密码重置成功");
}