import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  getCurrentUserHandler,
  getUserSaltByEmailHandler,
  loginHandler,
  logoutUserHandler,
} from "./userController";
import { loginBodySchema, paramEmailSchema } from "./userValidator";

/**
 * 路由层：只做路由注册 + 挂 validator，业务逻辑在 controller/service
 */
const userRouter = new Hono()
  .post(
    "/login",
    zValidator("json", loginBodySchema),
    loginHandler,
  )
  .get(
    "/getSalt/:email",
    zValidator("param", paramEmailSchema),
    getUserSaltByEmailHandler,
  )
  .post("/logout", logoutUserHandler)
  .get("/current", getCurrentUserHandler);

export { userRouter };
