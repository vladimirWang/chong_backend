import { HttpError } from "../models/HttpError";
import { errorCode } from "../models/Response";
import type { TenantPrismaClient } from "./prisma";

/**
 * 校验进出库明细行的两个通用规则：
 *  1. 同一张单据内 (productId, specSkuIds) 不可重复
 *  2. 所有 productId 须在当前租户下存在
 *
 * 归一化 specSkuIds 的职责由调用方先做（normalizeSpecSkuIds）。
 *
 * 同时适用于 StockIn 和 StockOut 中间表：
 *   ProductJoinStockIn / ProductJoinStockOut 都有
 *   @@unique([stockXxxId, productId, specSkuIds]) 硬约束，
 *   本函数在 DB 抛约束违例前给出友好中文报错。
 */
export async function assertStockLineProductsExist(
  db: TenantPrismaClient,
  lines: { productId: number; specSkuIds: string }[],
) {
  // 1. 重复校验（productId-specSkuIds 复合 key）
  const lineDatas = lines.map(
    (item) => `${item.productId}-${item.specSkuIds}`,
  );
  const uniqueLineDatas = [...new Set(lineDatas)];
  if (lineDatas.length > uniqueLineDatas.length) {
    throw new HttpError(
      400,
      errorCode.VALIDATION_ERROR,
      `提交的数据存在重复的产品（产品id-specSkuIds）: ${lineDatas.join(", ")}`,
    );
  }

  // 2. 产品存在性校验
  const uniqueProductIds = [
    ...new Set(uniqueLineDatas.map((item) => parseInt(item, 10))),
  ];
  const existing = await db.product.findMany({
    where: { id: { in: uniqueProductIds } },
    select: { id: true },
  });
  const existingIds = existing.map((p) => p.id);
  const missingIds = uniqueProductIds.filter(
    (id) => !existingIds.includes(id),
  );
  if (missingIds.length > 0) {
    throw new HttpError(
      400,
      errorCode.VALIDATION_ERROR,
      `产品不存在: ${missingIds.join(", ")}`,
    );
  }
}
