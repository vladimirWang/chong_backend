import { Elysia } from "elysia";
/**
 * 路由模块统一导出文件
 * 在这里导入所有路由模块，方便在 index.ts 中统一管理
 */
import { userRouter } from "./userRouter";
import { vendorRouter } from "./vendorRouter";
import { productRouter } from "./productRouter";
import { stockInRouter } from "./stockInRouter";
import { stockOutRouter } from "./stockOutRouter";
import { statisticsOutRouter } from "./statisticsOutRouter";
import { utilRouter } from "./utilRouter";

const testRouter = new Elysia().get("/ok", () => "Hello Elysia test123");

export const apiRouter = new Elysia().group(
  "/nodejs_api",
  {
    isSignIn: true,
    afterHandle({ response, set }) {
      // set.headers['content-type123123'] = 'text/html; charset=utf8123123'
      console.log("afterhandle response: ", response);
      return JSON.stringify(response);
    },
  },
  (app) => {
    return app
      .use(userRouter)
      .use(vendorRouter)
      .use(productRouter)
      .use(stockInRouter)
      .use(stockOutRouter)
      .use(statisticsOutRouter)
      .use(utilRouter);
  },
);
