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
import { createModuleLogger } from "../../utils/logger";

const log = createModuleLogger("file");

/** 上传目录（项目根/public/uploads，与 .gitignore public/uploads 对齐） */
const UPLOAD_DIR = join(process.cwd(), "public", "uploads");

async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    log.info("上传目录不存在，开始创建", { dir: UPLOAD_DIR });
    try {
      await mkdir(UPLOAD_DIR, { recursive: true });
    } catch (err) {
      log.error("创建上传目录失败（通常是宿主机挂载卷权限问题）", {
        dir: UPLOAD_DIR,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
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

  // 第一步：写磁盘（最常见失败点：挂载卷只读/权限不足/磁盘满）
  try {
    log.debug("写入文件到磁盘", { savePath, size: file.size });
    await Bun.write(savePath, file);
    if (!existsSync(savePath)) {
      throw new Error(`Bun.write 未报错但文件不存在: ${savePath}`);
    }
  } catch (err) {
    log.error("写磁盘失败", {
      savePath,
      uploadDir: UPLOAD_DIR,
      size: file.size,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  // 第二步：写 FileInfo 表（可能失败：审计 userId 外键不存在、DB 不可达）
  let created;
  try {
    created = await prisma.fileInfo.create({
      data: {
        hash,
        filePath,
        ...auditCreateConnect(user.userId),
      },
    });
  } catch (err) {
    log.error("写 FileInfo 表失败（磁盘文件已保存，需关注孤儿文件）", {
      savePath,
      filePath,
      hash,
      userId: user.userId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  return new SuccessResponse(
    {
      filePath: created.filePath,
      baseUrl: process.env.PUBLIC_BASE_URL,
      hash: created.hash,
    },
    "文件保存成功",
  );
}
