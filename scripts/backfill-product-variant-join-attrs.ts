/**
 * 一次性回填脚本：ProductVariant.specSkuIds → ProductVariantJoinAttr 关联行
 *
 * 执行顺序（路线 2 变体组合唯一性改造）：
 *   1. 迁移 1：20261005090000_add_product_variant_join_attr（纯建表）
 *   2. 本脚本：回填关联行（幂等，可重复执行/断点续跑）
 *   3. 校验通过后执行迁移 2：20261005090001_drop_product_variant_spec_sku_ids（删列）
 *   4. 本脚本完成使命后可删除
 *
 * 注意：specSkuIds 列已从 Prisma schema 移除（迁移 2 前列仍在库里），
 *       读取用原生 SQL；写入走 Prisma client（connect 形式）。
 *
 * 运行（在 repo_backend 目录，按目标环境选择 env 文件）：
 *   bunx dotenv -e .env.devLocal -- bun run scripts/backfill-product-variant-join-attrs.ts
 */
import { basePrisma } from "../src/utils/prisma";
import { parseSpecSkuIds } from "../src/utils/algo";

interface VariantRow {
  id: number;
  tenantId: number;
  specSkuIds: string;
  createdBy: number;
  updatedBy: number;
}

async function main() {
  const variants = await basePrisma.$queryRaw<VariantRow[]>`
    SELECT id, tenantId, specSkuIds, createdBy, updatedBy
    FROM ProductVariant
    WHERE deletedAt IS NULL AND specSkuIds <> ''
  `;
  console.log(`待回填变体数: ${variants.length}`);

  let created = 0;
  let skippedVariants = 0;

  for (const variant of variants) {
    const attrIds = parseSpecSkuIds(variant.specSkuIds);
    if (attrIds.length === 0) continue;

    // 仅接受同租户且未删除的 attr（软删过滤由扩展注入）
    const attrs = await basePrisma.attr.findMany({
      where: { id: { in: attrIds }, tenantId: variant.tenantId },
      select: { id: true, attrCategoryId: true },
    });
    if (attrs.length !== attrIds.length) {
      console.warn(
        `[跳过] 变体 ${variant.id} 的规格 [${variant.specSkuIds}] 含无效或跨租户/已删除 attr，请人工核查`,
      );
      skippedVariants++;
      continue;
    }

    // 幂等：跳过已存在的关联
    const existing = await basePrisma.productVariantJoinAttr.findMany({
      where: { productVariantId: variant.id },
      select: { attrId: true },
    });
    const existingSet = new Set(existing.map((e) => e.attrId));
    const toCreate = attrs.filter((a) => !existingSet.has(a.id));

    for (const attr of toCreate) {
      await basePrisma.productVariantJoinAttr.create({
        data: {
          productVariant: { connect: { id: variant.id } },
          attr: { connect: { id: attr.id } },
          attrCategoryId: attr.attrCategoryId,
          tenant: { connect: { id: variant.tenantId } },
          createdByUser: { connect: { id: variant.createdBy } },
          updatedByUser: { connect: { id: variant.updatedBy } },
        },
      });
      created++;
    }
  }

  console.log(
    `回填完成：新建关联 ${created} 条，跳过异常变体 ${skippedVariants} 个`,
  );

  // 校验：每个非空规格变体的关联行数应等于规格段数（库内 specSkuIds 已规范化去重）
  const mismatches = await basePrisma.$queryRaw<
    { id: number; specSkuIds: string; actual: bigint; expected: bigint }[]
  >`
    SELECT pv.id, pv.specSkuIds, COUNT(pvja.id) AS actual,
           CHAR_LENGTH(pv.specSkuIds) - CHAR_LENGTH(REPLACE(pv.specSkuIds, ',', '')) + 1 AS expected
    FROM ProductVariant pv
    LEFT JOIN ProductVariantJoinAttr pvja ON pvja.productVariantId = pv.id
    WHERE pv.deletedAt IS NULL AND pv.specSkuIds <> ''
    GROUP BY pv.id, pv.specSkuIds
    HAVING actual <> expected
  `;
  if (mismatches.length > 0) {
    console.error(
      `[校验失败] ${mismatches.length} 个变体的关联行数与规格数不一致：`,
      mismatches,
    );
    process.exitCode = 1;
  } else {
    console.log("[校验通过] 全部非空规格变体的关联集合与 specSkuIds 一致");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => basePrisma.$disconnect());
