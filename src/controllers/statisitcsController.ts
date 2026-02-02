import { SuccessResponse } from "../models/Response";
import prisma from "../utils/prisma";
import { GetHotSalesQuery } from "../validators/statisticsValidator";

// 获取热销商品
export const getHotSales = async ({ query }: { query: GetHotSalesQuery }) => {
  // const { startDate, endDate } = query;

  // // 设置时间范围
  // // startDate 设置为当天的开始时间（00:00:00）
  // const startDateTime = new Date(startDate);
  // startDateTime.setHours(0, 0, 0, 0);

  // // endDate 设置为当天的结束时间（23:59:59）
  // const endDateTime = new Date(endDate);
  // endDateTime.setHours(23, 59, 59, 999);

  // // 使用原始 SQL 查询，按商品分组计算总成交额，在数据库层面排序并限制为10条
  // // Prisma 会自动将 Date 对象转换为数据库兼容的格式
  // const sortedResult = await prisma.$queryRaw<
  //   Array<{
  //     productId: number;
  //     totalAmount: bigint; // SUM 的结果可能是 bigint
  //   }>
  // >`
  //   SELECT 
  //     pjso.productId,
  //     SUM(pjso.price * pjso.count) as totalAmount
  //   FROM ProductJoinStockOut pjso
  //   INNER JOIN StockOut so ON pjso.stockOutId = so.id
  //   WHERE so.completedAt >= ${startDateTime} AND so.completedAt <= ${endDateTime}
  //   GROUP BY pjso.productId
  //   ORDER BY totalAmount DESC
  //   LIMIT 10
  // `;

  // // 查询这些商品的信息
  // const productIds = sortedResult.map((item) => item.productId);
  // const products = await prisma.product.findMany({
  //   where: {
  //     id: {
  //       in: productIds,
  //     },
  //   },
  //   include: {
  //     Vendor: true,
  //   },
  // });

  // // 将商品信息和总成交额组合
  // const resultWithRelations = sortedResult.map((item) => {
  //   const product = products.find((p) => p.id === item.productId);
  //   return {
  //     productId: item.productId,
  //     totalAmount: Number(item.totalAmount), // 将 bigint 转换为 number
  //     product: product || null,
  //   };
  // });

  return JSON.stringify(
    new SuccessResponse([], "热销商品获取成功"),
  );
};
