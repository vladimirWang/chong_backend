import { Context, Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
const { JWT_SECRET } = process.env;
import dayjs from "dayjs";
import { redisClient } from "../utils/redis";

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

        `${prefix}/admin/user/login`,
        `${prefix}/admin/user/register`,
        `${prefix}/admin/user/checkEmailExisted/:email`,
        `${prefix}/admin/user/getSalt/:email`,
        `${prefix}/admin/user/resetPassword`,

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
        // const user = await jwt.verify(authorization);

        // const res = start.
        const user = JSON.parse(userInfoStr!);
        if (!user) return status(401);
        console.log("----user----: ", user);
        return {
          user,
        };
      } catch (error) {
        return status(401);
      }
    },
  },
});
