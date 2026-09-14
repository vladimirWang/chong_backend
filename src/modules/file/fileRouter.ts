import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { checkFileExistedByHashHandler, uploadFileHandler } from "./fileController";
import { paramHashSchema } from "./fileValidator";

/**
 * 文件处理路由（挂在 /file 下，需登录）
 * - GET  /file/checkFileExisted/:hash  秒传校验
 * - POST /file/upload                  文件上传（multipart/form-data）
 */
const fileRouter = new Hono()
  .get(
    "/checkFileExisted/:hash",
    zValidator("param", paramHashSchema),
    checkFileExistedByHashHandler,
  )
  // multipart 表单不适合 zValidator，参数校验在 controller 内完成
  .post("/upload", uploadFileHandler);

export { fileRouter };
