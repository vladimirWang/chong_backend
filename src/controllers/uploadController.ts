import { SuccessResponse } from "../models/Response";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// 上传目录路径
const UPLOAD_DIR = join(process.cwd(), "uploads");
const EXCEL_UPLOAD_DIR = join(process.cwd(), "uploads", "excel");

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

// 确保 Excel 上传目录存在
async function ensureExcelUploadDir() {
  if (!existsSync(EXCEL_UPLOAD_DIR)) {
    await mkdir(EXCEL_UPLOAD_DIR, { recursive: true });
  }
}

// 验证是否为 Excel 文件
function isValidExcelFile(file: File): boolean {
  // 通过 MIME 类型验证
  const allowedMimeTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel", // .xls
    "application/vnd.ms-excel.sheet.macroEnabled.12", // .xlsm
  ];
  
  // 通过文件扩展名验证（双重验证）
  const fileName = file.name.toLowerCase();
  const allowedExtensions = [".xlsx", ".xls", ".xlsm"];
  const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
  
  // MIME 类型可能为空或不准确，所以主要依赖扩展名验证
  const hasValidMimeType = !file.type || allowedMimeTypes.includes(file.type);
  
  return hasValidExtension && hasValidMimeType;
}

// 处理 Excel 文件上传
export const uploadExcelFile = async ({
  file,
}: {
  file: File;
}) => {
  try {
    // 确保 Excel 上传目录存在
    await ensureExcelUploadDir();

    // 验证文件类型
    if (!isValidExcelFile(file)) {
      throw new Error("文件类型必须是 Excel 格式（.xlsx, .xls, .xlsm）");
    }

    // 验证文件大小（例如：限制为 10MB）
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error(`文件大小不能超过 ${maxSize / 1024 / 1024}MB`);
    }

    if (file.size === 0) {
      throw new Error("文件不能为空");
    }

    // 生成唯一文件名
    const fileName = generateFileName(file.name);
    const filePath = join(EXCEL_UPLOAD_DIR, fileName);

    // 将文件转换为 ArrayBuffer 然后写入磁盘
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(filePath, buffer);

    // 返回文件信息
    const fileInfo = {
      originalName: file.name,
      fileName: fileName,
      filePath: `/uploads/excel/${fileName}`,
      size: file.size,
      type: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };

    return JSON.stringify(
      new SuccessResponse(fileInfo, "Excel 文件上传成功")
    );
  } catch (error) {
    throw error;
  }
};
