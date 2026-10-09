import type { ProductVariant } from "../generated/prisma/client";
import type { TenantPrismaClient } from "./prisma";

/** 变体解析可用的最小 db 能力（兼容租户客户端与交互式事务客户端） */
export type VariantResolveDb = Pick<
  TenantPrismaClient,
  "productVariant" | "productVariantJoinAttr"
>;

/**
 * 集合相等解析变体：给定产品与其 attrId 集合，找到规格组合恰好等于该集合（不多不少）的变体。
 *
 * 关系除法两步法（(productVariantId, attrId) 唯一，行数即集合大小）：
 * 1) 找出包含全部所需 attrId 的候选变体（匹配行数 = n）
 * 2) 过滤掉总关联数 > n 的超集变体，剩下即精确匹配
 *
 * 空集合（无规格商品）→ 解析「没有任何关联 attr」的变体。
 *
 * 注意：变体创建只允许发生在「SELECT ... FOR UPDATE 锁定 Product 行」的事务内
 * （见 stockInService.confirmCompleted），否则并发下存在重复组合窗口。
 */
export async function resolveVariant(
  db: VariantResolveDb,
  productId: number,
  attrIds: number[],
): Promise<ProductVariant | null> {
  const ids = [...new Set(attrIds)].sort((a, b) => a - b);
  const n = ids.length;

  if (n === 0) {
    // 无规格商品：组合为空集的变体
    return db.productVariant.findFirst({
      where: {
        productId,
        productVariantJoinAttrs: { none: {} },
      },
    });
  }

  // 步骤 1：包含全部所需 attrId 的候选变体
  // groupBy 不走软删除扩展，需显式过滤变体 deletedAt
  const matched = await db.productVariantJoinAttr.groupBy({
    by: ["productVariantId"],
    where: {
      productVariant: { productId, deletedAt: null },
      attrId: { in: ids },
    },
    _count: { attrId: true },
  });
  const candidateIds = matched
    .filter((m) => m._count.attrId === n)
    .map((m) => m.productVariantId);
  if (candidateIds.length === 0) return null;

  // 步骤 2：剔除超集（总关联数恰好为 n 的才是精确匹配）
  const totals = await db.productVariantJoinAttr.groupBy({
    by: ["productVariantId"],
    where: { productVariantId: { in: candidateIds } },
    _count: { attrId: true },
  });
  const exactId = totals.find((t) => t._count.attrId === n)?.productVariantId;
  if (exactId === undefined) return null;

  return db.productVariant.findUnique({ where: { id: exactId } });
}
