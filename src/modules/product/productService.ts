import type { TenantPrismaClient } from "../../utils/prisma";
import { getPaginationValues, getWhereValues } from "../../utils/db";
import { auditCreateConnect, auditUpdate } from "../../utils/auditUser";
import { SuccessResponse, errorCode } from "../../models/Response";
import { HttpError } from "../../models/HttpError";
import type { AuthUser } from "../../types/auth";
import { cacheQuery, cacheAside } from "../../utils/cacheDecorator";
import type {
  CreateProductBody,
  ProductAmountQuery,
  ProductQuery,
  UpdateProductBody,
} from "./productValidator";

/** 产品详情缓存 key 前缀，完整 key 为 product:detail:{tenantId}:{productId} */
const PRODUCT_DETAIL_CACHE_PREFIX = "product:detail";

/** 产品详情缓存 TTL（秒），10 分钟 */
const PRODUCT_DETAIL_CACHE_TTL = 600;

/**
 * 纯缓存读取（不回源）：命中返回产品详情，未命中返回 undefined。
 * 泛型在调用时指定。缓存 key 包含 tenantId 以保证租户隔离。
 *
 * @example
 * const detail = await getCachedProductDetail<ProductDetail>(`${tenantId}:${id}`);
 */
export const getCachedProductDetail = cacheQuery(PRODUCT_DETAIL_CACHE_PREFIX);

/**
 * 产品详情缓存 aside（读穿透 + 回源回填）
 *
 * 先查缓存，未命中执行 loader 回源查库并回填。泛型从 loader 自动推断。
 * key 格式 product:detail:{tenantId}:{productId}
 */
const getProductDetailWithCache = cacheAside(
  PRODUCT_DETAIL_CACHE_PREFIX,
  PRODUCT_DETAIL_CACHE_TTL,
);

/**
 * 产品业务层（移植自 repo_backend productController + productRouter 内联校验）
 */

/** GET /product：分页列表（productName 模糊），含 vendor 信息 */
export async function getProducts(db: TenantPrismaClient, query: ProductQuery) {
  const { limit, page, productName, pagination = "1" } = query;
  let skip: number | undefined;
  let take: number | undefined;
  if (pagination) {
    const info = getPaginationValues({ limit: limit ?? 20, page: page ?? 1 });
    skip = info.skip;
    take = info.take;
  }
  const whereValues = getWhereValues({ name: productName });

  const list = await db.product.findMany({
    skip,
    take,
    where: whereValues,
    include: { vendor: true },
  });
  const total = await db.product.count({ where: whereValues });

  return new SuccessResponse({ total, list }, "产品列表获取成功");
}

/**
 * GET /product/:id：先查缓存，未命中回源查库并回填缓存。
 *
 * 缓存 key 含 tenantId 保证租户隔离；img 拼接 PUBLIC_BASE_URL 前缀后入缓存，
 * 因该变量为部署级常量，同一环境内缓存数据可直接复用。
 *
 * @param db 租户级 prisma 实例（回源查询用）
 * @param id 产品 ID
 * @param tenantId 租户 ID（缓存 key 隔离用）
 */
export async function getProductById(
  db: TenantPrismaClient,
  id: number,
  tenantId: number,
) {
  const res = await getProductDetailWithCache(
    `${tenantId}:${id}`,
    async () => {
      const row = await db.product.findUnique({
        where: { id },
        select: {
          historyCost: true,
          name: true,
          img: true,
          balance: true,
          vendorId: true,
          remark: true,
          latestCost: true,
          latestPrice: true,
          salePrice: true,
          desc: true,
          productJoinSkus: {
            select: {
              sku: {
                select: {
                  id: true,
                  name: true,
                  skuCategoryId: true,
                  skuCategory: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      });
      if (!row) return undefined;
      if (row.img) {
        // 未配置 PUBLIC_BASE_URL 时按空前缀处理（老架构会拼出 "undefined/..."）
        row.img = `${process.env.PUBLIC_BASE_URL ?? ""}${row.img}`;
      }
      return row;
    },
  );
  return new SuccessResponse(res ?? null, "产品信息查询成功");
}

/** POST /product：创建（同供应商下名称唯一） */
export async function createProduct(
  db: TenantPrismaClient,
  user: AuthUser,
  body: CreateProductBody,
) {
  if (!user) {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, "未登录");
  }
  const { name, remark, vendorId, salePrice, img, desc, skuIds } = body;

  const productExisted = await db.product.findFirst({
    where: { name, vendorId },
  });
  if (productExisted) {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, "产品已存在");
  }

  const uniqueSkuIds = skuIds ? Array.from(new Set(skuIds)) : [];
  if (uniqueSkuIds.length > 0) {
    const skuCount = await db.sku.count({
      where: { id: { in: uniqueSkuIds } },
    });
    if (skuCount !== uniqueSkuIds.length) {
      throw new HttpError(400, errorCode.VALIDATION_ERROR, "SKU不存在");
    }
  }

  const product = await db.$transaction(async tx => {
    const created = await tx.product.create({
      data: {
        name,
        remark,
        img,
        vendor: { connect: { id: vendorId } },
        salePrice,
        desc,
        ...auditCreateConnect(user.userId),
      } as never,
    });
    for (const skuId of uniqueSkuIds) {
      await tx.productJoinSku.create({
        data: {
          product: { connect: { id: created.id } },
          sku: { connect: { id: skuId } },
          ...auditCreateConnect(user.userId),
        } as never,
      });
    }
    return created;
  });
  return new SuccessResponse(product, "产品创建成功");
}

/** PATCH /product/:id：更新（产品须存在）；未传字段 undefined 由 Prisma 忽略 */
export async function updateProduct(
  db: TenantPrismaClient,
  user: AuthUser,
  id: number,
  body: UpdateProductBody,
) {
  if (!user) {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, "未登录");
  }
  const productExisted = await db.product.findUnique({ where: { id } });
  if (!productExisted) {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, "产品不存在");
  }

  const { salePrice, name, remark, img, desc, skuIds } = body;

  // skuIds 未传表示不修改 SKU 关联；传了（含空数组）则全量同步
  const syncSkuIds = skuIds ? Array.from(new Set(skuIds)) : undefined;

  const product = await db.$transaction(async tx => {
    if (syncSkuIds && syncSkuIds.length > 0) {
      const skuCount = await tx.sku.count({
        where: { id: { in: syncSkuIds } },
      });
      if (skuCount !== syncSkuIds.length) {
        throw new HttpError(400, errorCode.VALIDATION_ERROR, "SKU不存在");
      }
    }

    const updated = await tx.product.update({
      where: { id },
      data: {
        name,
        desc,
        remark,
        img,
        salePrice,
        ...auditUpdate(user.userId),
      },
    });

    if (syncSkuIds) {
      // 关联表仅为映射关系，直接物理删除后重建（含清空场景）
      await tx.productJoinSku.deleteMany({ where: { productId: id } });
      for (const skuId of syncSkuIds) {
        await tx.productJoinSku.create({
          data: {
            product: { connect: { id } },
            sku: { connect: { id: skuId } },
            ...auditCreateConnect(user.userId),
          } as never,
        });
      }
    }

    return updated;
  });
  return new SuccessResponse(product, "产品更新成功");
}

/** DELETE /product/:id：老架构仅为占位响应（不落库），保持一致 */
export function deleteProduct(id: number) {
  return new SuccessResponse({ message: `产品 ${id} 删除成功` }, "");
}

/** GET /product/getProductsByVendorId/:vendorId */
export async function getProductsByVendorId(
  db: TenantPrismaClient,
  vendorId: number,
) {
  const list = await db.product.findMany({ where: { vendorId } });
  const total = await db.product.count({ where: { vendorId } });
  return new SuccessResponse({ total, list }, "产品列表获取成功");
}

/** GET /product/getLatestSalePriceByProductId/:id：历史成本列表（语义同老架构） */
export async function getLatestSalePriceByProductId(
  db: TenantPrismaClient,
  id: number,
) {
  const list = await db.historyCost.findMany({
    where: {
      productId: id,
      // 与老架构一致：显式指定时软删除扩展不会覆盖，这里查的是 deletedAt 非空的记录
      deletedAt: { not: null },
    },
  });
  return new SuccessResponse({ list }, "历史成本列表查询成功");
}

/** GET /product/checkProductNameExistedInVendor/:vendorId?productName= */
export async function checkProductNameExistedInVendor(
  db: TenantPrismaClient,
  vendorId: number,
  productName: string,
) {
  const existed = await db.product.findFirst({
    where: { vendorId, name: productName },
  });
  // 老架构消息文案如此（疑似复制粘贴遗留），保持契约一致
  return new SuccessResponse(existed, "产品最近一次建议零售价获取成功");
}

/** GET /product/getProductsByAmount：按库存数量阈值过滤并排序 */
export async function getProductsByAmount(
  db: TenantPrismaClient,
  query: ProductAmountQuery,
) {
  const { amount, moreThan, desc = true } = query;
  const list = await db.product.findMany({
    where: {
      balance: moreThan ? { gt: amount } : { lt: amount },
    },
    orderBy: { balance: desc ? "desc" : "asc" },
    include: { vendor: true },
  });
  return new SuccessResponse({ list }, "产品列表获取成功");
}
