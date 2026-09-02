import { Context, Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
const { JWT_SECRET } = process.env;
import dayjs from "dayjs";
import { redisClient } from "../utils/redis";
import prisma, { createTenantPrisma, TenantPrismaClient } from "../utils/prisma";

/**
 * 登录态注入的 user 对象结构（来自 Redis 中保存的 JWT payload）
 * 包含 tenantId，用于创建租户级 prisma 实例
 */
export type AuthUser = {
  userId: number;
  email: string;
  username: string;
  tenantId: number;
  role?: string;
  exp?: number | string;
  [k: string]: any;
};

/** isSignIn 宏成功后注入 ctx 的字段类型 */
export type AuthInject = {
  user: AuthUser;
  /** 带当前 tenantId 过滤的 prisma 实例（业务表 CRUD 一律用它） */
  tenantPrisma: TenantPrismaClient;
  /** 当前租户 ID（等价于 user.tenantId，方便解构） */
  tenantId: number;
};

export const authService = new Elysia({ name: "Auth.Service" }).macro({
  isSignIn: {
    async resolve(ctx: Context) {
      const prefix = "/nodejs_api";
      const publicRoutes = [
        `${prefix}/user/login`,
        `${prefix}/user/register`,
        `${prefix}/user/checkEmailExisted/:email`,
        `${prefix}/user/checkEmailNotExisted/:email`,
        `${prefix}/user/getSalt/:email`,
        `${prefix}/user/resetPassword`,
        `${prefix}/user/oauth/github`,
        `${prefix}/user/oauth/github/callback`,
        `${prefix}/user/oauth/github/exchange`,
        `${prefix}/user/registerByToken`,

        `${prefix}/admin/user/login`,
        `${prefix}/admin/user/register`,
        `${prefix}/admin/user/checkEmailExisted/:email`,
        `${prefix}/admin/user/getSalt/:email`,
        `${prefix}/admin/user/resetPassword`,
        `${prefix}/admin/user/registerShortCut`,

        `${prefix}/applicant/sendInviteCode`,
        `${prefix}/applicant/checkInviteCode`,
        `${prefix}/applicant/checkApplicantExisted/:email`,

        // util
        `${prefix}/util/captcha`,
        `${prefix}/util/get-nonce`,
        `${prefix}/util/sendEmailVerificationCode`,
        `${prefix}/util/checkEmailValidation`,
        `${prefix}/util/getInviteCode`,
        `${prefix}/util/checkInviteCode`,
      ];
      // 对于公共路由，不进行鉴权
      if (publicRoutes.includes(ctx.route) || ctx.route.startsWith("/public")) {
        return;
      }
      const {
        cookie,
        status,
        headers: { authorization },
        request,
        route,
      } = ctx;
      if (!authorization) return status(401);

      const userInfoStr = await redisClient.get(`token:${authorization}`);
      if (!userInfoStr) {
        return status(401);
      }
      try {
        // token认证，返回用户信息
        const user = JSON.parse(userInfoStr!) as AuthUser;
        if (!user) return status(401);
        console.log("----user----: ", user);

        // ⬇️⬇️⬇️ 关键：按当前 tenantId 创建 prisma 扩展实例，注入到 ctx
        const tenantId = user.tenantId;
        const tenantPrisma = createTenantPrisma(prisma, tenantId);

        return {
          user,
          tenantPrisma,
          tenantId,
        };
      } catch (error) {
        return status(401);
      }
    },
  },
});
