import type { Context } from "elysia";
import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import { BusinessError } from "../errors/BusinessError";
import {
  LoginUserBody,
  RegisterUserBody,
  UploadFileBody,
  UpdatePasswordBody,
} from "../validators/userValidator";
import prisma from "../utils/prisma";
import svgCaptcha from "svg-captcha";
import { redisClient } from "../utils/redis";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger";
import { sanitizeFilename, UPLOAD_DIR } from "../utils/file";
import path from "node:path";
import fs from "node:fs";
import {
  ParamAdminEmailExistedTransform,
  RegisterAdminUserShortCutBody,
} from "../validators/adminCommonValidator";
import { emailVerificationTag } from "./utilController";
import {
  generateFixedSalt,
  generateNonce,
  sha256,
  isValidNonce,
} from "../utils/algo";
import { sendEmail } from "../utils/mailer";
import type { AuthContext, JwtPayload } from "./userController";
import { generateInitialPassword } from "../utils/common";
import { ParamEmail } from "../validators/commonValidator";

export const loginUser = async ({
  body,
  jwt,
}: {
  body: LoginUserBody;
  /** 由主应用挂载 @elysiajs/jwt 后注入；子路由类型推断不含 jwt，故标为可选 */
  jwt?: any;
}) => {
  const isValid = await isValidNonce(body.nonce);
  if (!isValid) {
    return new ErrorResponse(errorCode.NONCE_INVALID, "nonce无效");
  }
  const redisKey = `captcha:login:${body.captchaId}`;
  const storedCaptcha = await redisClient.get(redisKey);
  if (!storedCaptcha) {
    return new ErrorResponse(errorCode.CAPTCHA_EXPIRED, "验证码已过期");
  }
  // 删除验证码，防止重复使用
  await redisClient.del(redisKey);
  // redis中存的验证码与用户提交的验证码不一致
  if (storedCaptcha.toLowerCase() !== body.captchaText.toLowerCase()) {
    return new ErrorResponse(errorCode.CAPTCHA_INCORRECT, "验证码不正确");
  }
  const userExisted = await prisma.adminUser.findFirst({
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
  const ACCOUNT_LOCKED_KEY = "adminLogin:locked:" + body.email;
  const lockStatus = await redisClient.get(ACCOUNT_LOCKED_KEY);
  if (lockStatus) {
    const result = new ErrorResponse(errorCode.ACCOUNT_LOCKED, "账号已锁定");
    return result;
  }
  // 密码错误次数的key
  const loginFailedKey = `adminLogin:failed:${body.email}`;
  // const calculatedPassword = sha256(userExisted.password + "_" + body.nonce);
  // const passwordHash = sha256(body.password + "_" + userExisted.salt);
  const calculatedPassword = sha256(userExisted.password + "_" + body.nonce);

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
  // 生成 token（@elysiajs/jwt 的 sign 只接收一个 payload，exp 需写在 payload 里才会生效）
  const payload: JwtPayload = {
    userId: userExisted.id,
    email: userExisted.email,
    username: userExisted.username,
    // AdminUser 跨租户，无 tenantId
    exp: "1d",
    role: "admin",
  };
  const token = await jwt!.sign(payload);

  // 把token保存到redis中，有效期1天
  await redisClient.setEx(
    `token:${token}`,
    60 * 60 * 24,
    JSON.stringify(payload),
  );
  console.log("---------------token------------------: ", token);

  return new SuccessResponse<string>(token, "用户登录成功");
};

export const registerAdminUserShortCut = async ({
  body,
}: {
  body: RegisterAdminUserShortCutBody;
}) => {
  const { email, password } = body;
  const username = email.split("@")[0];
  const salt = generateFixedSalt();

  const passwordHash = sha256(password + "_" + salt);
  console.log("passwordHash: ", passwordHash);
  console.log("salt: ", salt);
  await prisma.adminUser.create({
    data: {
      email,
      password: passwordHash,
      username,
      salt,
    },
  });
  return new SuccessResponse(null, "用户创建成功");
};

export const registerUser = async ({ body }: { body: RegisterUserBody }) => {
  const { username, email, password, verifyCode } = body;

  // redis查邮箱和验证码是否匹配
  // const redisKey = `email:verify:${email}`;
  const verifyCodeRedisKey = `${emailVerificationTag}:${email}`;
  const verifiCodeInRedis = await redisClient.get(verifyCodeRedisKey);
  console.log("verifiCodeInRedis: ", verifiCodeInRedis);
  console.log("verifyCode: ", verifyCode);
  if (verifiCodeInRedis !== verifyCode) {
    return new ErrorResponse(errorCode.EMAIL_VALIDATION_FAIL, "邮箱验证失败");
  }

  await redisClient.del(verifyCodeRedisKey);

  const salt = generateFixedSalt();

  const passwordHash = sha256(password + "_" + salt);

  // return new SuccessResponse(salt, "盐生成成功");

  const user = await prisma.adminUser.create({
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
      "文件已存在",
    );
  } else {
    return new SuccessResponse(
      {
        filePath: "",
        baseUrl: process.env.PUBLIC_BASE_URL,
      },
      "文件不存在",
    );
  }
};

export const checkEmailExisted = async ({ params }: { params: ParamEmail }) => {
  const { email } = params;
  const user = await prisma.adminUser.findUnique({
    where: {
      email,
    },
  });
  return new SuccessResponse(Boolean(user), "邮箱已存在");
};

export const getUserSaltByEmail = async ({
  params,
}: {
  params: ParamAdminEmailExistedTransform;
}) => {
  // 由 paramAdminEmailExistedTransformSchema 预查询并注入 user（含 salt）
  if (!params.user) {
    throw new BusinessError(errorCode.USER_NOT_FOUND, "邮箱未注册");
  }
  return new SuccessResponse(params.user.salt, "获取salt成功");
};

// 修改密码
export const updatePassword = async ({
  body,
  user,
}: AuthContext & { body: UpdatePasswordBody }) => {
  const { current, password, nonce } = body;
  if (!user) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "未登录");
  }
  console.log("changePassword user: ", user);
  const userMatched = await prisma.adminUser.findFirst({
    where: {
      id: user.userId,
    },
  });
  if (!userMatched) {
    return new ErrorResponse(errorCode.USER_NOT_FOUND, "用户不存在");
  }

  const calculatedPassword = sha256(userMatched.password + "_" + nonce);
  console.log("calculatedPassword: ", current, nonce, calculatedPassword);
  if (calculatedPassword !== current) {
    return new ErrorResponse(errorCode.PASSWORD_INCORRECT, "密码不正确");
  }
  const passwordHash = sha256(password + "_" + userMatched.salt);
  await prisma.adminUser.update({
    where: {
      id: userMatched.id,
    },
    data: {
      password: passwordHash,
    },
  });
  return new SuccessResponse(null, "密码修改成功");
};

export const resetPassword = async ({
  body,
}: {
  body: ParamAdminEmailExistedTransform;
}) => {
  const { user: userMatched } = body;
  if (!userMatched) {
    throw new BusinessError(errorCode.USER_NOT_FOUND, "邮箱未注册");
  }
  const initialPassword = generateInitialPassword(6);

  const passwordHash = sha256(initialPassword + "_" + userMatched.salt);
  await prisma.adminUser.update({
    where: {
      id: userMatched.id,
    },
    data: {
      password: passwordHash,
    },
  });
  await sendEmail(
    userMatched.email,
    "密码重置成功",
    `您的初始密码为：${initialPassword}`,
  );
  return new SuccessResponse(null, "密码重置成功，初始密码已发送至您的邮箱");
};
