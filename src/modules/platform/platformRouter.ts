import { Hono } from "hono";
import { getPlatformsHandler } from "./platformController";

/** 平台路由（只读；挂在 apiRouter 下，默认需要登录——与老架构父组 isSignIn 一致） */
const platformRouter = new Hono().get("/", getPlatformsHandler);

export { platformRouter };
