import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
const { JWT_SECRET } = process.env;
import dayjs from "dayjs";
import { redisClient } from "../utils/redis";

export const authService = new Elysia({ name: "Auth.Service" }).macro({
  isSignIn: {
    async resolve(ctx: Context) {
      const apiUrl = "/nodejs_api";
      const publicRoutes = [
        "/nodejs_api/user/login",
        "/nodejs_api/user/register",
        "/nodejs_api/user/captcha",
        "/nodejs_api/util/sendEmailVerificationCode",
        "/nodejs_api/util/checkEmailValidation",
        "/nodejs_api/user/checkEmailExisted/:email",
        "/nodejs_api/user/get-nonce",
        "/nodejs_api/user/getSalt/:email",
        "/nodejs_api/user/resetPassword",
      ];
      // 对于公共路由，不进行鉴权
      if (publicRoutes.includes(ctx.route) || ctx.route.startsWith("/public")) {
        return;
      }
      const {
        cookie,
        status,
        headers: { authorization },
        jwt,
        request,
        url,
        route,
      } = ctx;
      console.log("inside auth macro: authorization: ", authorization);
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
