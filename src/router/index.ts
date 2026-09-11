import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";
import { userRouter } from "../modules/user/userRouter";
import { utilRouter } from "../modules/util/utilRouter";
import { vendorRouter } from "../modules/vendor/vendorRouter";

/**
 * 汇总各业务模块路由，统一挂到 /nodejs_api（与 repo_backend 对齐）
 * authMiddleware 挂在最外层：默认鉴权，公共路由靠白名单放行（与老架构 isSignIn 宏一致）
 */
export const apiRouter = new Hono()
  .use("*", authMiddleware)
  .route("/user", userRouter)
  .route("/util", utilRouter)
  .route("/vendor", vendorRouter);
