import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
const { JWT_SECRET } = process.env;

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
      const user = await jwt.verify(authorization);
      console.log("jwt verify result: ", user);

      if (!user) return status(401);

      return {
        user,
      };
    },
  },
});
