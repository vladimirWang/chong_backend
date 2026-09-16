import type { Context } from "hono";
import { ErrorResponse, errorCode } from "../../models/Response";
import { checkFileExistedByHash, uploadFile } from "./fileService";
import type { ParamHash } from "./fileValidator";
import { createModuleLogger } from "../../utils/logger";

const log = createModuleLogger("file");

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
  const user = c.get("user") as { userId: number } | undefined;

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch (err) {
    log.warn("上传请求解析 multipart 失败", {
      userId: user?.userId,
      contentType: c.req.header("content-type"),
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json(
      new ErrorResponse(errorCode.VALIDATION_ERROR, "请使用 multipart/form-data 上传文件"),
    );
  }

  const rawHash = form.get("hash");
  const hash = typeof rawHash === "string" ? rawHash.trim() : "";
  if (!hash) {
    log.warn("上传缺少 hash 字段", {
      userId: user?.userId,
      formFields: Array.from(form.keys()),
    });
    return c.json(new ErrorResponse(errorCode.VALIDATION_ERROR, "缺少 hash 字段"));
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    log.warn("上传缺少 file 字段", { userId: user?.userId, hash });
    return c.json(new ErrorResponse(errorCode.VALIDATION_ERROR, "缺少文件字段 file"));
  }
  if (file.size === 0) {
    log.warn("上传文件为空", { userId: user?.userId, hash, fileName: file.name });
    return c.json(new ErrorResponse(errorCode.VALIDATION_ERROR, "文件为空"));
  }

  log.info("开始上传文件", {
    userId: user?.userId,
    hash,
    fileName: file.name,
    size: file.size,
    mimeType: file.type,
  });

  try {
    const result = await uploadFile(hash, file, c.get("user"));
    log.info("文件上传完成", { userId: user?.userId, hash, fileName: file.name });
    return c.json(result);
  } catch (err) {
    // 分段失败原因已在 service 内记录，这里补请求上下文
    log.error("文件上传异常", {
      userId: user?.userId,
      hash,
      fileName: file.name,
      size: file.size,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    throw err;
  }
};
