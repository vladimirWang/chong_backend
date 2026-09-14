import { Hono } from "hono";
import { standardizeHandler } from "./imageController";

/**
 * 图片处理路由（挂在 /image 下，需登录）
 * 实际处理逻辑在独立的 Python gRPC 服务 image_service 中
 */
const imageRouter = new Hono()
  // multipart 表单不适合 zValidator，参数校验在 controller 内完成
  .post("/standardize", standardizeHandler);

export { imageRouter };
