import { sign } from "hono/jwt";
import prisma from "../../utils/prisma";
import { redisClient } from "../../utils/redis";
import { generateFixedSalt, isValidNonce, sha256 } from "../../utils/algo";
import { generateInitialPassword } from "../../utils/common";
import { sendEmail } from "../../utils/mailer";
import {
  ErrorResponse,
  SuccessResponse,
  errorCode,
} from "../../models/Response";
import type { AuthUser } from "../../types/auth";
import type {
  LoginBody,
  RegisterBody,
  RegisterShortCutBody,
  UpdatePasswordBody,
} from "./adminUserValidator";

/** 邮箱验证码在 redis 中的 key 前缀（与 repo_backend utilController.emailVerificationTag 一致） */
const emailVerificationTag = "register:emailVerification";

type AdminJwtPayload = {
  userId: number;
  email: string;
  username: string | null;
  // AdminUser 跨租户，无 tenantId
  exp: number;
  role: "admin";
};

/**
 * 管理员登录（移植自 repo_backend adminUserController.loginUser）
 * 流程与普通用户登录一致，仅查询表（AdminUser）与 redis key 前缀（adminLogin）不同
 */
export async function loginAdminUser(body: LoginBody) {
  // 1. nonce 校验
  const isValid = await isValidNonce(body.nonce);
  if (!isValid) {
    return new ErrorResponse(errorCode.NONCE_INVALID, "nonce无效");
  }

  // 2. 图形验证码
  const redisKey = `captcha:login:${body.captchaId}`;
  const storedCaptcha = await redisClient.get(redisKey);
  if (!storedCaptcha) {
    return new ErrorResponse(errorCode.CAPTCHA_EXPIRED, "验证码已过期");
  }
  await redisClient.del(redisKey);
  if (storedCaptcha.toLowerCase() !== body.captchaText.toLowerCase()) {
    return new ErrorResponse(errorCode.CAPTCHA_INCORRECT, "验证码不正确");
  }

  // 3. 管理员存在性
  const userExisted = await prisma.adminUser.findFirst({
    where: { email: body.email },
  });
  if (!userExisted) {
    return new ErrorResponse(errorCode.USER_NOT_FOUND, "用户不存在");
  }

  // 4. 账号是否冻结
  const ACCOUNT_LOCKED_KEY = "adminLogin:locked:" + body.email;
  const lockStatus = await redisClient.get(ACCOUNT_LOCKED_KEY);
  if (lockStatus) {
    return new ErrorResponse(errorCode.ACCOUNT_LOCKED, "账号已锁定");
  }

  // 5. 密码比对（失败计数 / 锁定，逻辑与普通用户一致）
  const loginFailedKey = `adminLogin:failed:${body.email}`;
  const calculatedPassword = sha256(userExisted.password + "_" + body.nonce);
  if (calculatedPassword !== body.password) {
    const FREEZE_DURATION = 60 * 60;
    const loginFailedCount = await redisClient.get(loginFailedKey);
    if (loginFailedCount) {
      await redisClient.incr(loginFailedKey);
      await redisClient.expire(loginFailedKey, FREEZE_DURATION);
      const COUNT_OF_PASSWORD_WRONG = 6;
      if (Number(loginFailedCount) === COUNT_OF_PASSWORD_WRONG - 1) {
        await redisClient.setEx(ACCOUNT_LOCKED_KEY, FREEZE_DURATION, "1");
      }
    } else {
      await redisClient.setEx(loginFailedKey, FREEZE_DURATION, "1");
    }
    return new ErrorResponse(errorCode.PASSWORD_INCORRECT, "密码不正确");
  }
  await redisClient.del(loginFailedKey);

  // 6. 签发 JWT（hono/jwt 的 exp 为数字秒级时间戳，有效期 1 天）
  const payload: AdminJwtPayload = {
    userId: userExisted.id,
    email: userExisted.email,
    username: userExisted.username,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    role: "admin",
  };
  const token = await sign(payload, process.env.JWT_SECRET!);

  // 7. token 存 redis（登出删除即立即失效）
  await redisClient.setEx(
    `token:${token}`,
    60 * 60 * 24,
    JSON.stringify(payload),
  );

  return new SuccessResponse<string>(token, "用户登录成功");
}

/**
 * 管理员注册（需邮箱验证码，公共路由）
 * 移植自 repo_backend adminUserController.registerUser
 */
export async function registerAdminUser(body: RegisterBody) {
  const { username, email, password, verifyCode } = body;

  const verifyCodeRedisKey = `${emailVerificationTag}:${email}`;
  const verifiCodeInRedis = await redisClient.get(verifyCodeRedisKey);
  if (verifiCodeInRedis !== verifyCode) {
    return new ErrorResponse(errorCode.EMAIL_VALIDATION_FAIL, "邮箱验证失败");
  }
  await redisClient.del(verifyCodeRedisKey);

  const salt = generateFixedSalt();
  const passwordHash = sha256(password + "_" + salt);

  const user = await prisma.adminUser.create({
    data: { email, password: passwordHash, username, salt },
  });

  return new SuccessResponse(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      createdAt: user.createdAt,
    },
    "用户创建成功",
  );
}

/**
 * 快捷创建管理员（内部初始化用，公共路由）
 * 移植自 repo_backend adminUserController.registerAdminUserShortCut
 */
export async function registerAdminUserShortCut(body: RegisterShortCutBody) {
  const { email, password } = body;
  const username = email.split("@")[0];
  const salt = generateFixedSalt();
  const passwordHash = sha256(password + "_" + salt);

  await prisma.adminUser.create({
    data: { email, password: passwordHash, username, salt },
  });
  return new SuccessResponse(null, "用户创建成功");
}

/** 管理员邮箱是否已注册 */
export async function checkAdminEmailExisted(email: string) {
  const user = await prisma.adminUser.findUnique({ where: { email } });
  return new SuccessResponse<boolean>(Boolean(user), "邮箱已存在");
}

/** 管理员邮箱是否未注册（注册页用） */
export async function checkAdminEmailNotExisted(email: string) {
  const user = await prisma.adminUser.findUnique({ where: { email } });
  const existed = Boolean(user);
  return new SuccessResponse<boolean>(
    !existed,
    existed ? "邮箱已存在" : "邮箱不存在",
  );
}

/**
 * 按邮箱取管理员 salt（登录前置，公共路由）
 * 移植自 repo_backend getUserSaltByEmail
 */
export async function getAdminUserSaltByEmail(email: string) {
  const user = await prisma.adminUser.findFirst({ where: { email } });
  if (!user) {
    return new ErrorResponse(errorCode.USER_NOT_FOUND, "邮箱未注册");
  }
  return new SuccessResponse<string>(user.salt, "获取salt成功");
}

/**
 * 重置密码：生成随机初始密码并邮件发送（公共路由）
 * 移植自 repo_backend adminUserController.resetPassword
 */
export async function resetAdminPassword(email: string) {
  const userMatched = await prisma.adminUser.findFirst({ where: { email } });
  if (!userMatched) {
    return new ErrorResponse(errorCode.USER_NOT_FOUND, "邮箱未注册");
  }
  const initialPassword = generateInitialPassword(6);
  const passwordHash = sha256(initialPassword + "_" + userMatched.salt);
  await prisma.adminUser.update({
    where: { id: userMatched.id },
    data: { password: passwordHash },
  });
  await sendEmail(
    userMatched.email,
    "密码重置成功",
    `您的初始密码为：${initialPassword}`,
  );
  return new SuccessResponse(null, "密码重置成功，初始密码已发送至您的邮箱");
}

/**
 * 修改密码（需登录）
 * 移植自 repo_backend adminUserController.updatePassword
 */
export async function updateAdminPassword(
  body: UpdatePasswordBody,
  user: AuthUser | undefined,
) {
  const { current, password, nonce } = body;
  if (!user) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "未登录");
  }
  const userMatched = await prisma.adminUser.findFirst({
    where: { id: user.userId },
  });
  if (!userMatched) {
    return new ErrorResponse(errorCode.USER_NOT_FOUND, "用户不存在");
  }

  const calculatedPassword = sha256(userMatched.password + "_" + nonce);
  if (calculatedPassword !== current) {
    return new ErrorResponse(errorCode.PASSWORD_INCORRECT, "密码不正确");
  }
  const passwordHash = sha256(password + "_" + userMatched.salt);
  await prisma.adminUser.update({
    where: { id: userMatched.id },
    data: { password: passwordHash },
  });
  return new SuccessResponse(null, "密码修改成功");
}
