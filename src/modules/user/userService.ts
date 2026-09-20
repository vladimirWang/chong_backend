import { sign } from "hono/jwt";
import prisma from "../../utils/prisma";
import { redisClient } from "../../utils/redis";
import { sha256, isValidNonce, generateFixedSalt } from "../../utils/algo";
import {
  ErrorResponse,
  SuccessResponse,
  errorCode,
} from "../../models/Response";
import { createModuleLogger } from "../../utils/logger";
import type { AuthUser } from "../../types/auth";
import type { LoginBody, RegisterByTokenBody, UpdatePasswordBody } from "./userValidator";

const logger = createModuleLogger("user");

export type JwtPayload = {
  userId: number;
  email: string;
  username: string | null;
  tenantId: number | null;
  exp: number;
  role: "merchant" | "admin";
  isSuperUser?: boolean;
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
  //    查 Tenant.superUserId 判断是否为租户超级管理员
  const isSuperUser = await prisma.tenant.findFirst({
    where: { superUserId: userExisted.id },
    select: { id: true },
  }).then(t => t !== null);

  const payload: JwtPayload = {
    userId: userExisted.id,
    email: userExisted.email,
    username: userExisted.username,
    tenantId: userExisted.tenantId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    role: "merchant",
    isSuperUser,
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
 * 按邮箱检查用户是否已存在（注册 / 忘记密码前置校验，公共路由无需登录）
 * 移植自 repo_backend checkEmailExisted
 */
export async function checkEmailExisted(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  const existed = Boolean(user);
  return new SuccessResponse<boolean>(existed, existed ? "邮箱已存在" : "邮箱不存在");
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

/**
 * 用户登出（移植自 repo_backend logoutUser）
 * 登录态以 redis token:{token} 存在性为准，删除即立即失效（JWT 本身不做验签）
 * authorization header 由 authMiddleware 保证存在（未登录在中间件就被 401）
 */
export async function logoutUser(token: string) {
  await redisClient.del(`token:${token}`);
  return new SuccessResponse(null, "用户登出成功");
}

/**
 * 通过激活 token 注册用户（公共路由，无需登录）
 *
 * 租户归属在申请/审核阶段已写入 applicant.tenantId：
 * - join  型：申请时关联已 ACTIVE 租户，激活只建 User
 * - create 型：审核通过时创建 PENDING 占位租户，激活时建 User、绑定 superUserId、租户置为 ACTIVE
 */
export async function registerUserByToken(body: RegisterByTokenBody) {
  const { token, password, username } = body;

  // 1. 校验 token
  const tokenRecord = await prisma.applicantActivationToken.findFirst({
    where: { tokenHash: token },
    include: { applicant: true },
  });
  if (!tokenRecord) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "token 不存在");
  }
  if (tokenRecord.usedAt) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "token 已使用");
  }
  if (tokenRecord.revokedAt) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "token 已作废");
  }
  if (tokenRecord.expiresAt < new Date()) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "token 已过期");
  }

  const applicant = tokenRecord.applicant;

  // 2. 邮箱是否已注册（申请到激活存在最长 7 天窗口，激活时复查兜底）
  const userExisted = await prisma.user.findUnique({
    where: { email: applicant.email },
  });
  if (userExisted) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "该邮箱已注册");
  }

  // 3. 租户归属必须已在审核阶段确定
  const tenantId = applicant.tenantId;
  if (tenantId == null) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "申请信息异常，请重新提交申请");
  }

  // 4. 事务：创建 User +（PENDING 租户：绑定 superUserId 并置 ACTIVE）
  //    + 更新 Applicant 为 ACTIVATED + 标记 token 已使用
  const salt = generateFixedSalt();
  const passwordHash = sha256(password + "_" + salt);

  try {
    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        throw new Error("租户不存在");
      }
      if (tenant.status === "SUSPENDED" || tenant.status === "DISABLED") {
        throw new Error("租户已停用");
      }

      const newUser = await tx.user.create({
        data: {
          email: applicant.email,
          password: passwordHash,
          username,
          salt,
          // tenantId: tenant.id,
          tenant: {
            connect: { id: tenant.id },
          }
        },
      });

      // create 型：审核时创建的 PENDING 占位租户，在激活时启用并绑定超级管理员
      if (tenant.status === "PENDING") {
        await tx.tenant.update({
          where: { id: tenant.id },
          data: { status: "ACTIVE", superUserId: newUser.id },
        });
      }

      await tx.applicant.update({
        where: { id: applicant.id },
        data: { status: "ACTIVATED" },
      });
      await tx.applicantActivationToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      });
    });
  } catch (error) {
    logger.error(
      `registerUserByToken error: ${error instanceof Error ? error.stack ?? error.message : String(error)}`,
    );
    const msg = error instanceof Error ? error.message : "注册失败，已回滚";
    return new ErrorResponse(errorCode.SYSTEM_ERROR, msg);
  }

  return new SuccessResponse(null, "用户注册成功");
}

/**
 * 修改密码（需登录）
 * 移植自 adminUserService.updateAdminPassword，查询 prisma.user
 * 新增校验：新密码不能与旧密码一致
 */
export async function updateUserPassword(
  body: UpdatePasswordBody,
  user: AuthUser | undefined,
) {
  const { current, password, nonce } = body;
  if (!user) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "未登录");
  }
  const userMatched = await prisma.user.findFirst({
    where: { id: user.userId },
  });
  if (!userMatched) {
    return new ErrorResponse(errorCode.USER_NOT_FOUND, "用户不存在");
  }

  // 校验当前密码：sha256(库中password + "_" + nonce) 必须等于前端传来的 current
  const calculatedPassword = sha256(userMatched.password + "_" + nonce);
  if (calculatedPassword !== current) {
    return new ErrorResponse(errorCode.PASSWORD_INCORRECT, "密码不正确");
  }

  // 校验新密码不能与旧密码一致
  const newPasswordHash = sha256(password + "_" + userMatched.salt);
  if (newPasswordHash === userMatched.password) {
    return new ErrorResponse(
      errorCode.VALIDATION_ERROR,
      "新密码不能与旧密码一致",
    );
  }

  await prisma.user.update({
    where: { id: userMatched.id },
    data: { password: newPasswordHash },
  });
  return new SuccessResponse(null, "密码修改成功");
}
