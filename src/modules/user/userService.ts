import { sign } from "hono/jwt";
import prisma from "../../utils/prisma";
import { redisClient } from "../../utils/redis";
import { sha256, isValidNonce } from "../../utils/algo";
import {
  ErrorResponse,
  SuccessResponse,
  errorCode,
} from "../../models/Response";
import type { AuthUser } from "../../types/auth";
import type { LoginBody } from "./userValidator";

export type JwtPayload = {
  userId: number;
  email: string;
  username: string | null;
  tenantId: number | null;
  exp: number;
  role: "merchant" | "admin";
};

/**
 * 登录业务逻辑（移植自 repo_backend 的 loginUser）
 * 流程：nonce 防重放 → 图形验证码 → 用户存在性 → 账号锁定 → 密码比对（失败计数/锁定）→ 签发 JWT → token 入 redis
 */
export async function loginUser(body: LoginBody) {
  // 1. nonce 校验（5 分钟有效 + redis 防重放）
  const isValid = await isValidNonce(body.nonce);
  if (!isValid) {
    return new ErrorResponse(errorCode.NONCE_INVALID, "nonce无效");
  }

  // 2. 图形验证码：redis 比对后立即删除，防止重复使用
  const redisKey = `captcha:login:${body.captchaId}`;
  const storedCaptcha = await redisClient.get(redisKey);
  if (!storedCaptcha) {
    return new ErrorResponse(errorCode.CAPTCHA_EXPIRED, "验证码已过期");
  }
  await redisClient.del(redisKey);
  if (storedCaptcha.toLowerCase() !== body.captchaText.toLowerCase()) {
    return new ErrorResponse(errorCode.CAPTCHA_INCORRECT, "验证码不正确");
  }

  // 3. 用户存在性
  const userExisted = await prisma.user.findFirst({
    where: {
      email: body.email,
    },
  });
  if (!userExisted) {
    return new ErrorResponse(errorCode.USER_NOT_FOUND, "用户不存在");
  }

  // 4. 账号是否冻结
  const ACCOUNT_LOCKED_KEY = "login:locked:" + body.email;
  const lockStatus = await redisClient.get(ACCOUNT_LOCKED_KEY);
  if (lockStatus) {
    return new ErrorResponse(errorCode.ACCOUNT_LOCKED, "账号已锁定");
  }

  // 5. 密码比对：
  //    注册时库中 password = sha256(明文 + "_" + salt)
  //    登录时客户端提交 sha256(库中password + "_" + nonce)，nonce 参与哈希防重放
  const loginFailedKey = `login:failed:${body.email}`;
  const calculatedPassword = sha256(userExisted.password + "_" + body.nonce);
  if (calculatedPassword !== body.password) {
    // 1 小时窗口内累计失败 6 次锁定账号
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
  // 密码正确，清空失败计数
  await redisClient.del(loginFailedKey);

  // 6. 签发 JWT（有效期 1 天；hono/jwt 的 exp 为数字秒级时间戳）
  const payload: JwtPayload = {
    userId: userExisted.id,
    email: userExisted.email,
    username: userExisted.username,
    tenantId: userExisted.tenantId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    role: "merchant",
  };
  const token = await sign(payload, process.env.JWT_SECRET!);

  // 7. token 存 redis（有效期 1 天，登出时删除）
  await redisClient.setEx(
    `token:${token}`,
    60 * 60 * 24,
    JSON.stringify(payload),
  );

  return new SuccessResponse<string>(token, "用户登录成功");
}

/**
 * 按邮箱取用户 salt（登录第一步，客户端用它推导 passwordHash）
 * 移植自 repo_backend：resolveUserByEmail + getUserSaltByEmail
 */
export async function getUserSaltByEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // 与老架构行为一致：邮箱未注册不暴露 USER_NOT_FOUND，按校验失败处理
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "邮箱未注册");
  }
  return new SuccessResponse<string>(user.salt, "获取salt成功");
}

/**
 * 获取当前登录用户信息（payload 由 authMiddleware 注入，移植自 repo_backend getCurrentUser）
 */
export function getCurrentUser(user: AuthUser | undefined) {
  if (!user) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "未登录");
  }
  return new SuccessResponse<AuthUser>(user, "获取用户信息成功");
}
