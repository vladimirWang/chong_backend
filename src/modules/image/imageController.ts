import type { Context } from "hono";
import { ErrorResponse } from "../../models/Response";
import { errorCode } from "../../models/Response";
import {
  standardizeProductImage,
  type StandardizeProductImageParams,
} from "./imageService";
import {
  isInvalidImageArgumentError,
  type ImageOutputFormat,
} from "../../utils/imageGrpcClient";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const VALID_FORMATS: ImageOutputFormat[] = ["PNG", "JPEG", "WEBP"];

function parseBool(v: FormDataEntryValue | null): boolean | undefined {
  if (v === null) return undefined;
  return String(v) === "true" || String(v) === "1";
}

function parseIntOpt(v: FormDataEntryValue | null): number | undefined {
  if (v === null || String(v).trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

/**
 * POST /image/standardize（multipart/form-data，需登录）
 *
 * 表单字段：
 *   file             图片文件（必填）
 *   removeBackground "true" 开启 AI 抠图（Python 端需装 rembg extra）
 *   maxWidth         等比缩放最大宽
 *   maxHeight        等比缩放最大高
 *   square           "true" 方形补边
 *   background       背景色，默认 #FFFFFF
 *   format           PNG / JPEG / WEBP
 *   quality          1-100，默认 90
 *
 * 成功直接返回处理后的图片二进制（Content-Type 为实际图片类型），
 * 元信息放在响应头 X-Image-Width/Height/Original-Size/Processed-Size。
 */
export const standardizeHandler = async (c: Context) => {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json(new ErrorResponse(errorCode.VALIDATION_ERROR, "请使用 multipart/form-data 上传文件"));
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return c.json(new ErrorResponse(errorCode.VALIDATION_ERROR, "缺少图片文件字段 file"));
  }
  if (file.size === 0) {
    return c.json(new ErrorResponse(errorCode.VALIDATION_ERROR, "上传文件为空"));
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return c.json(new ErrorResponse(errorCode.VALIDATION_ERROR, "图片不能超过 20MB"));
  }

  const formatRaw = String(form.get("format") || "").toUpperCase();
  if (formatRaw && !VALID_FORMATS.includes(formatRaw as ImageOutputFormat)) {
    return c.json(
      new ErrorResponse(errorCode.VALIDATION_ERROR, `format 仅支持 ${VALID_FORMATS.join("/")}`),
    );
  }

  const params: StandardizeProductImageParams = {
    removeBackground: parseBool(form.get("removeBackground")),
    maxWidth: parseIntOpt(form.get("maxWidth")),
    maxHeight: parseIntOpt(form.get("maxHeight")),
    square: parseBool(form.get("square")),
    background: (form.get("background") as string | null) || undefined,
    outputFormat: (formatRaw as ImageOutputFormat) || undefined,
    jpegQuality: parseIntOpt(form.get("quality")),
  };

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await standardizeProductImage(buffer, params);

    c.header("Content-Type", result.mimeType);
    c.header("Content-Length", String(result.processedSize));
    c.header("X-Image-Width", String(result.width));
    c.header("X-Image-Height", String(result.height));
    c.header("X-Image-Original-Size", String(result.originalSize));
    c.header("X-Image-Processed-Size", String(result.processedSize));
    c.header("X-Image-Background-Removed", String(result.backgroundRemoved));
    // Hono body 类型要求 Uint8Array<ArrayBuffer>，Buffer 泛型是 ArrayBufferLike，包一层拷贝
    return c.body(new Uint8Array(result.buffer));
  } catch (err) {
    const message = err instanceof Error ? err.message : "图片标准化失败";
    const code = isInvalidImageArgumentError(err)
      ? errorCode.VALIDATION_ERROR
      : errorCode.SYSTEM_ERROR;
    return c.json(new ErrorResponse(code, message));
  }
};
