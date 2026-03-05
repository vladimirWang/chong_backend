import path from "path";

/**
 * 处理/清理文件名（与 Go utils.SanitizeFilename 逻辑一致）
 * - 去除首尾空格
 * - 提取扩展名
 * - 过滤非法字符（路径分隔符、系统禁止字符）
 * - 限制主文件名长度为 100 个字符（按 Unicode 字符计算）
 *
 * @param filename 原始文件名
 * @returns { safeMain, ext } 清理后的主文件名和扩展名
 * @throws 当文件名为空或非法时
 */
export function sanitizeFilename(
  filename: string,
): { safeMain: string; ext: string } {
  const trimmed = filename.trim();
  if (trimmed === "") {
    throw new Error("文件名不合法");
  }

  const ext = path.extname(trimmed);
  let main = ext ? trimmed.slice(0, -ext.length) : trimmed;
  main = main.trim();

  // 过滤非法字符（路径分隔符、系统禁止字符）
  const unsafeChars = /[\\/:*?"<>|\r\n\t]/g;
  main = main.replace(unsafeChars, "_");

  const maxMainLength = 100;
  if (Array.from(main).length > maxMainLength) {
    main = Array.from(main).slice(0, maxMainLength).join("");
  }

  return { safeMain: main, ext };
}
