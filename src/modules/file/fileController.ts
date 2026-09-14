import type { Context } from "hono";
import { ErrorResponse, errorCode } from "../../models/Response";
import { checkFileExistedByHash, uploadFile } from "./fileService";
import type { ParamHash } from "./fileValidator";

/** GET /file/checkFileExisted/:hash：秒传校验（需登录） */
export const checkFileExistedByHashHandler = async (c: Context) => {
  const { hash } = c.req.valid("param" as never) as ParamHash;
  return c.json(await checkFileExistedByHash(hash));
};

/** POST /file/upload：文件上传（multipart/form-data，需登录）
 *
 * 表单字段：
 *   hash  文件 hash（必填，前端计算 MD5）
 *   file  文件（必填）
 */
export const uploadFileHandler = async (c: Context) => {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json(
      new ErrorResponse(errorCode.VALIDATION_ERROR, "请使用 multipart/form-data 上传文件"),
    );
  }

  const hash = form.get("hash");
  if (!hash || String(hash).trim() === "") {
    return c.json(new ErrorResponse(errorCode.VALIDATION_ERROR, "缺少 hash 字段"));
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return c.json(new ErrorResponse(errorCode.VALIDATION_ERROR, "缺少文件字段 file"));
  }
  if (file.size === 0) {
    return c.json(new ErrorResponse(errorCode.VALIDATION_ERROR, "文件为空"));
  }

  const result = await uploadFile(String(hash), file, c.get("user"));
  return c.json(result);
};
