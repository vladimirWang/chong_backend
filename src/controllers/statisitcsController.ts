import { SuccessResponse } from "../models/Response";
import prisma from "../utils/prisma";
import { GetHotSalesQuery } from "../validators/statisticsValidator";

// 获取热销商品
export const getHotSales = async ({ query }: { query: GetHotSalesQuery }) => {
  const { startDate, endDate } = query;

  // 设置时间范围
  // startDate 设置为当天的开始时间（00:00:00）
  const startDateTime = new Date(startDate);
  startDateTime.setHours(0, 0, 0, 0);

  // endDate 设置为当天的结束时间（23:59:59）
  const endDateTime = new Date(endDate);
  endDateTime.setHours(23, 59, 59, 999);

  // 使用原始 SQL 查询，在数据库层面按 price * count 排序并限制为10条
  // Prisma 会自动将 Date 对象转换为数据库兼容的格式
  const sortedResult = await prisma.$queryRaw<
    Array<{
      id: number;
      productId: number;
      stockOutId: number;
      price: number;
      count: number;
    }>
  >`
    SELECT pjso.id, pjso.productId, pjso.stockOutId, pjso.price, pjso.count
    FROM ProductJoinStockOut pjso
    INNER JOIN StockOut so ON pjso.stockOutId = so.id
    WHERE so.completedAt >= ${startDateTime} AND so.completedAt <= ${endDateTime}
    ORDER BY pjso.price * pjso.count DESC
    LIMIT 10
  `;

  // 如果需要包含关联的 product 和 stockOut 数据，需要额外查询
  const resultWithRelations = await Promise.all(
    sortedResult
      .map(async (item) => {
        const res = await prisma.productJoinStockOut.findFirst({
          where: { id: item.id },
          include: {
            product: true,
            stockOut: true,
          },
        });
        return res;
      })
      .filter(Boolean),
  );

  return JSON.stringify(
    new SuccessResponse(resultWithRelations, "热销商品获取成功"),
  );
};
