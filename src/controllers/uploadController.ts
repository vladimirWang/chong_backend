import { SuccessResponse } from "../models/Response";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// 上传目录路径
const UPLOAD_DIR = join(process.cwd(), "uploads");

// 确保上传目录存在
async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

// 生成唯一的文件名
function generateFileName(originalName: string): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15);
  const ext = originalName.split(".").pop() || "";
  return `${timestamp}_${randomStr}.${ext}`;
}

// 处理文件上传
export const uploadFile = async ({
  file,
}: {
  file: File;
}) => {
  try {
    // 确保上传目录存在
    await ensureUploadDir();

    // 验证文件类型（双重验证，虽然 Elysia 已经验证过）
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("文件类型必须是图片格式（jpeg, jpg, png, gif, webp, svg）");
    }

    // 生成唯一文件名
    const fileName = generateFileName(file.name);
    const filePath = join(UPLOAD_DIR, fileName);

    // 将文件转换为 ArrayBuffer 然后写入磁盘
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(filePath, buffer);

    // 返回文件信息
    const fileInfo = {
      originalName: file.name,
      fileName: fileName,
      filePath: `/uploads/${fileName}`,
      size: file.size,
      type: file.type,
    };

    return JSON.stringify(
      new SuccessResponse(fileInfo, "文件上传成功")
    );
  } catch (error) {
    throw error;
  }
};
