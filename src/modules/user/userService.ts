import { sign } from "hono/jwt";
import { randomBytes } from "node:crypto";
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
 * 新流程：申请时已确定租户（applicant.tenantId=join型 / applicant.tenantName=create型）
 *         激活时只需 token + username + password，租户信息从 applicant 记录取
 * 兼容旧流程：如果 applicant 没有租户信息，回退到请求体 tenantOption/tenantCode/tenantName
 *
 * create 型：事务内创建 Tenant + User，再回写 Tenant.superUserId = 新 User.id
 * join  型：applicant.tenantId 已在申请时写入，直接创建 User
 */
export async function registerUserByToken(body: RegisterByTokenBody) {
  const { token, password, username, tenantOption, tenantName, tenantCode } =
    body;

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

  // 2. 邮箱是否已注册
  const userExisted = await prisma.user.findUnique({
    where: { email: applicant.email },
  });
  if (userExisted) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "该邮箱已注册");
  }

  // 3. 确定租户：优先用 applicant 已有的信息，回退到请求体
  //    join 型：applicant.tenantId 已在 sendInviteCode 时写入
  //    create 型：applicant.tenantName 已在 sendInviteCode 时写入
  const isCreate =
    applicant.tenantId == null &&
    (applicant.tenantName != null ||
      (tenantOption === "create" && tenantName != null));

  // 4. 事务：创建 User + (create 型: 创建 Tenant + 回写 superUserId) + 更新 Applicant + 标记 token 已使用
  const salt = generateFixedSalt();
  const passwordHash = sha256(password + "_" + salt);

  try {
    await prisma.$transaction(async (tx) => {
      if (isCreate) {
        // create 型：在新事务内创建 Tenant
        const nameToUse = applicant.tenantName ?? tenantName!;
        const nameExisted = await tx.tenant.findUnique({
          where: { name: nameToUse },
        });
        if (nameExisted) {
          throw new Error("租户名称已存在");
        }
        const generatedCode = randomBytes(3).toString("hex");
        // 先创建 Tenant（superUserId 暂为 null）
        const newTenant = await tx.tenant.create({
          data: { name: nameToUse, code: generatedCode },
        });
        // 创建 User
        const newUser = await tx.user.create({
          data: {
            email: applicant.email,
            password: passwordHash,
            username,
            salt,
            tenantId: newTenant.id,
          },
        });
        // 回写 superUserId
        await tx.tenant.update({
          where: { id: newTenant.id },
          data: { superUserId: newUser.id },
        });
        await tx.applicant.update({
          where: { id: applicant.id },
          data: {
            status: "ACTIVATED",
            tenantId: newTenant.id,
          },
        });
      } else {
        // join 型：tenantId 已在 applicant 中，或从请求体 tenantCode 查找
        let tenantId: number;
        if (applicant.tenantId != null) {
          tenantId = applicant.tenantId;
        } else {
          // 兼容旧流程：从请求体 tenantCode 查找
          if (!tenantCode) {
            throw new Error("请填写租户编码");
          }
          const tenant = await tx.tenant.findUnique({
            where: { code: tenantCode },
          });
          if (!tenant) {
            throw new Error("租户编码不存在");
          }
          if (tenant.status !== "ACTIVE") {
            throw new Error("租户已停用");
          }
          tenantId = tenant.id;
        }
        await tx.user.create({
          data: {
            email: applicant.email,
            password: passwordHash,
            username,
            salt,
            tenantId,
          },
        });
        await tx.applicant.update({
          where: { id: applicant.id },
          data: {
            status: "ACTIVATED",
            tenantId,
          },
        });
      }
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
