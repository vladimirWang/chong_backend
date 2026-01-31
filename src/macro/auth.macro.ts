import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
const { JWT_SECRET } = process.env;

export const authService = new Elysia({ name: "Auth.Service" }).macro({
  isSignIn: {
    async resolve(ctx: Context) {
      const apiUrl = "/api";
      const publicRoutes = [
        "/api/user/login",
        "/api/user/register",
        "/api/user/captcha",
        "/api/util/sendEmailVerificationCode",
        '/api/util/checkEmailValidation'
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
