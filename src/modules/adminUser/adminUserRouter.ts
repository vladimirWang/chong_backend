import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  checkEmailExistedHandler,
  checkEmailNotExistedHandler,
  checkFileExistedByHashHandler,
  getUserSaltByEmailHandler,
  loginHandler,
  registerHandler,
  registerShortCutHandler,
  resetPasswordHandler,
  updatePasswordHandler,
} from "./adminUserController";
import {
  loginBodySchema,
  paramEmailSchema,
  paramHashSchema,
  registerBodySchema,
  registerShortCutBodySchema,
  resetPasswordBodySchema,
  updatePasswordBodySchema,
} from "./adminUserValidator";

/**
 * 管理员用户路由（挂在 /admin/user 下）
 * 公共：login / register / registerShortCut / checkEmailExisted /
 *       checkEmailNotExisted / getSalt / resetPassword（在 authMiddleware 白名单放行）
 * 需登录：updatePassword / checkFileExisted
 */
const adminUserRouter = new Hono()
  .post("/login", zValidator("json", loginBodySchema), loginHandler)
  .post(
    "/register",
    zValidator("json", registerBodySchema),
    registerHandler,
  )
  .post(
    "/registerShortCut",
    zValidator("json", registerShortCutBodySchema),
    registerShortCutHandler,
  )
  .get(
    "/checkEmailExisted/:email",
    zValidator("param", paramEmailSchema),
    checkEmailExistedHandler,
  )
  .get(
    "/checkEmailNotExisted/:email",
    zValidator("param", paramEmailSchema),
    checkEmailNotExistedHandler,
  )
  .get(
    "/getSalt/:email",
    zValidator("param", paramEmailSchema),
    getUserSaltByEmailHandler,
  )
  .post(
    "/resetPassword",
    zValidator("json", resetPasswordBodySchema),
    resetPasswordHandler,
  )
  .post(
    "/updatePassword",
    zValidator("json", updatePasswordBodySchema),
    updatePasswordHandler,
  )
  .get(
    "/checkFileExisted/:hash",
    zValidator("param", paramHashSchema),
    checkFileExistedByHashHandler,
  );

export { adminUserRouter };
