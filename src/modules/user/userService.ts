import prisma from "../../utils/prisma";
import { redisClient } from "../../utils/redis";
import {
  ErrorResponse,
  SuccessResponse,
  errorCode,
} from "../../models/Response";
import type { AuthUser } from "../../types/auth";

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
 * 按邮箱检查用户是否已存在（注册前置校验，公共路由无需登录）
 */
export async function checkEmailExisted(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  const existed = Boolean(user);
  return new SuccessResponse<boolean>(existed, existed ? "邮箱已存在" : "邮箱不存在");
}

/**
 * 获取当前登录用户信息（payload 由 authMiddleware 注入）
 */
export function getCurrentUser(user: AuthUser | undefined) {
  if (!user) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "未登录");
  }
  return new SuccessResponse<AuthUser>(user, "获取用户信息成功");
}

/**
 * 用户登出
 * 登录态以 redis token:{token} 存在性为准，删除即立即失效
 */
export async function logoutUser(token: string) {
  await redisClient.del(`token:${token}`);
  return new SuccessResponse(null, "用户登出成功");
}
