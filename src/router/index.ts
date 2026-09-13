import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";
import { accessLogMiddleware } from "../middleware/accessLogMiddleware";
import { userRouter } from "../modules/user/userRouter";
import { utilRouter } from "../modules/util/utilRouter";
import { vendorRouter } from "../modules/vendor/vendorRouter";
import { productRouter } from "../modules/product/productRouter";
import { stockInRouter } from "../modules/stockIn/stockInRouter";
import { stockOutRouter } from "../modules/stockOut/stockOutRouter";
import { platformRouter } from "../modules/platform/platformRouter";
import { clientRouter } from "../modules/client/clientRouter";
import { statisticsRouter } from "../modules/statistics/statisticsRouter";
import { analyticsRouter } from "../modules/analytics/analyticsRouter";
import { applicantRouter } from "../modules/applicant/applicantRouter";
import { adminUserRouter } from "../modules/adminUser/adminUserRouter";

/**
 * 汇总各业务模块路由，统一挂到 /nodejs_api（与 repo_backend 对齐）
 * authMiddleware 挂在最外层：默认鉴权，公共路由靠白名单放行（与老架构 isSignIn 宏一致）
 */
export const apiRouter = new Hono()
  .use("*", authMiddleware)
  .use("*", accessLogMiddleware)
  .route("/user", userRouter)
  .route("/util", utilRouter)
  .route("/vendor", vendorRouter)
  .route("/product", productRouter)
  .route("/stockin", stockInRouter)
  .route("/stockout", stockOutRouter)
  .route("/platform", platformRouter)
  .route("/client", clientRouter)
  .route("/statistics", statisticsRouter)
  .route("/analytics", analyticsRouter)
  .route("/applicant", applicantRouter)
  .route("/admin/user", adminUserRouter);
