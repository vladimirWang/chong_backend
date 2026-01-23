import { SuccessResponse } from "../models/Response";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import * as XLSX from "xlsx";

// Excel 解析后的数据格式
export interface StockInRecord {
  productId: number;
  vendorId: number;
  count: number;
  cost: number;
}

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

// 解析 Excel 文件为 StockInRecord[]
// Excel 文件格式：从第三行开始为进货数据，字段顺序固定为 vendorId, productId, count, cost
function parseExcelToStockInRecords(buffer: Buffer): StockInRecord[] {
  try {
    // 读取 Excel 文件
    const workbook = XLSX.read(buffer, { type: "buffer" });
    
    // 获取第一个工作表
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error("Excel 文件中没有工作表");
    }
    
    const worksheet = workbook.Sheets[firstSheetName];
    
    // 将工作表转换为 JSON 数组
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, // 使用数组格式，第一行作为数据
      defval: null, // 空单元格返回 null
    }) as any[][];
    
    if (jsonData.length < 3) {
      throw new Error("Excel 文件数据不足，至少需要3行（前两行为表头，第三行开始为数据）");
    }
    
    // 字段顺序固定：vendorId, productId, count, cost
    const vendorIdIndex = 0;
    const productIdIndex = 1;
    const countIndex = 2;
    const costIndex = 3;
    
    // 从第三行开始解析数据（索引为2）
    const dataStartRow = 2;
    const records: StockInRecord[] = [];
    
    for (let i = dataStartRow; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      // 跳过空行
      if (!row || row.length === 0 || row.every((cell: any) => cell === null || cell === undefined || cell === "")) {
        continue;
      }
      
      // 提取数据（按固定顺序：vendorId, productId, count, cost）
      const vendorId = Number(row[vendorIdIndex]);
      const productId = Number(row[productIdIndex]);
      const count = Number(row[countIndex]);
      const cost = Number(row[costIndex]);
      
      // 验证数据有效性
      if (isNaN(vendorId) || isNaN(productId) || isNaN(count) || isNaN(cost)) {
        throw new Error(`第 ${i + 1} 行数据格式不正确，请确保所有字段都是数字`);
      }
      
      if (vendorId <= 0 || productId <= 0 || count <= 0 || cost < 0) {
        throw new Error(`第 ${i + 1} 行数据无效，供应商ID、产品ID和数量必须大于0，成本不能为负数`);
      }
      
      records.push({
        productId,
        vendorId,
        count,
        cost,
      });
    }
    
    if (records.length === 0) {
      throw new Error("Excel 文件中没有有效的数据行（从第三行开始）");
    }
    
    return records;
  } catch (error: any) {
    throw new Error(`解析 Excel 文件失败: ${error.message}`);
  }
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

    // 解析 Excel 文件
    const records = parseExcelToStockInRecords(buffer);

    // 返回文件信息和解析后的数据
    const result = {
      originalName: file.name,
      fileName: fileName,
      filePath: `/uploads/excel/${fileName}`,
      size: file.size,
      type: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      records: records,
    };

    return JSON.stringify(
      new SuccessResponse(result, "Excel 文件上传并解析成功")
    );
  } catch (error) {
    throw error;
  }
};
