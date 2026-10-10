import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  checkEmailExistedHandler,
  getCurrentUserHandler,
  logoutUserHandler,
  ssoExchangeHandler,
} from "./userController";
import {
  paramEmailSchema,
  ssoExchangeBodySchema,
} from "./userValidator";

/**
 * 路由层：只做路由注册 + 挂 validator，业务逻辑在 controller/service
 * 本地密码登录已下线，仅保留 SSO 统一登录 + 公共查询 + 登出
 */
const userRouter = new Hono()
  .post(
    "/sso/exchange",
    zValidator("json", ssoExchangeBodySchema),
    ssoExchangeHandler,
  )
  .get(
    "/checkEmailExisted/:email",
    zValidator("param", paramEmailSchema),
    checkEmailExistedHandler,
  )
  .post("/logout", logoutUserHandler)
  .get("/current", getCurrentUserHandler);

export { userRouter };
