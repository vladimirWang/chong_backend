import { join } from "path";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import prisma from "../../utils/prisma";
import { auditCreateConnect } from "../../utils/auditUser";
import {
  ErrorResponse,
  SuccessResponse,
  errorCode,
} from "../../models/Response";
import type { AuthUser } from "../../types/auth";

/** 上传目录（项目根/public/uploads，与 .gitignore public/uploads 对齐） */
const UPLOAD_DIR = join(process.cwd(), "public", "uploads");

async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

/** 生成存储文件名：uuid + 原扩展名 */
function generateStorageName(originalName: string): string {
  const ext = originalName.split(".").pop() || "";
  return crypto.randomUUID() + (ext ? "." + ext : "");
}

/**
 * 秒传校验：按文件 hash 查是否已上传过（需登录）
 * 移植自旧 Elysia userController.checkFileExistedByHash
 */
export async function checkFileExistedByHash(hash: string) {
  const fileInfo = await prisma.fileInfo.findFirst({ where: { hash } });
  return new SuccessResponse(
    {
      filePath: fileInfo?.filePath ?? "",
      baseUrl: process.env.PUBLIC_BASE_URL,
    },
    fileInfo ? "文件已存在" : "文件不存在",
  );
}

/**
 * 文件上传（需登录）
 * 移植自旧 Elysia userController.uploadFile
 *
 * 流程：确保目录 → 写文件 → 写 FileInfo 表（含审计字段）
 */
export async function uploadFile(
  hash: string,
  file: File,
  user: AuthUser | undefined,
) {
  if (!user) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "未登录");
  }

  await ensureUploadDir();

  const storageName = generateStorageName(file.name);
  const savePath = join(UPLOAD_DIR, storageName);
  const filePath = `/uploads/${storageName}`;

  await Bun.write(savePath, file);

  const created = await prisma.fileInfo.create({
    data: {
      hash,
      filePath,
      ...auditCreateConnect(user.userId),
    },
  });

  return new SuccessResponse(
    {
      filePath: created.filePath,
      baseUrl: process.env.PUBLIC_BASE_URL,
      hash: created.hash,
    },
    "文件保存成功",
  );
}
