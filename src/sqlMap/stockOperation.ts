export const generateStockOperationSql = <T>(
  mainTable: string,
  innerTable: string,
  query: T,
) => {
  const {
    pagination = true,
    limit = 10,
    page = 1,
    deletedStart,
    deletedEnd,
    productName,
    vendorName,
    completedStart,
    completedEnd,
  } = query;
  // 校验后已是 string | undefined，只做 trim
  const productNameStr =
    productName != null && typeof productName === "string"
      ? productName.trim()
      : undefined;
  const vendorNameStr =
    vendorName != null && typeof vendorName === "string"
      ? vendorName.trim()
      : undefined;

  const hasVendorFilter = Boolean(vendorNameStr && vendorNameStr.length > 0);

  // 用片段 + 参数数组拼 SQL，避免 Prisma.sql 嵌套导致参数顺序错乱（MariaDB）
  const whereClauses: string[] = ["1=1"];
  const params: unknown[] = [];

  if (productNameStr) {
    whereClauses.push("p.name LIKE ?");
    params.push(`%${productNameStr}%`);
  }

  // raw 查询不经过 $extends，需手动加「未删除」条件，与 findMany 行为一致
  if (deletedStart || deletedEnd) {
    if (deletedStart) {
      whereClauses.push("s.deletedAt >= ?");
      params.push(dayjs(deletedStart).format("YYYY-MM-DD HH:mm:ss"));
    }
    if (deletedEnd) {
      whereClauses.push("s.deletedAt <= ?");
      params.push(dayjs(deletedEnd).format("YYYY-MM-DD HH:mm:ss"));
    }
  } else {
    whereClauses.push("s.deletedAt IS NULL");
  }

  if (completedStart) {
    whereClauses.push("s.completedAt >= ?");
    params.push(dayjs(completedStart).format("YYYY-MM-DD HH:mm:ss"));
  }
  if (completedEnd) {
    whereClauses.push("s.completedAt <= ?");
    params.push(dayjs(completedEnd).format("YYYY-MM-DD HH:mm:ss"));
  }

  if (hasVendorFilter) {
    whereClauses.push("v.name LIKE ?");
    params.push(`%${vendorNameStr}%`);
  }

  const vendorJoinSql = hasVendorFilter
    ? " INNER JOIN Vendor v ON v.id = p.vendorId "
    : "";
  const whereSql = "WHERE " + whereClauses.join(" AND ");

  const listSql =
    `SELECT DISTINCT s.id, s.remark, s.createdAt, s.updatedAt, s.deletedAt, ${mainTable === "StockIn" ? "s.totalCost" : "s.totalPrice"}, s.status, s.completedAt ` +
    `FROM ${mainTable} s ` +
    `INNER JOIN ${innerTable} pjs ON ${mainTable === "StockIn" ? "pjs.stockInId" : "pjs.stockOutId"} = s.id ` +
    `INNER JOIN Product p ON p.id = pjs.productId` +
    vendorJoinSql +
    ` ${whereSql} ORDER BY s.updatedAt DESC` +
    (pagination ? " LIMIT ? OFFSET ?" : "");

  const countSql =
    `SELECT COUNT(DISTINCT s.id) as cnt FROM ${mainTable} s ` +
    `INNER JOIN ${innerTable} pjs ON ${mainTable === "StockIn" ? "pjs.stockInId" : "pjs.stockOutId"} = s.id ` +
    `INNER JOIN Product p ON p.id = pjs.productId` +
    vendorJoinSql +
    ` ${whereSql}`;

  return { listSql, params, countSql };
};
