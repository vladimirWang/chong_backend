import type { TenantPrismaClient } from "../../utils/prisma";
import { getPaginationValues, getWhereValues } from "../../utils/db";
import { auditCreateConnect, auditUpdate } from "../../utils/auditUser";
import { SuccessResponse, errorCode } from "../../models/Response";
import { HttpError } from "../../models/HttpError";
import type { AuthUser } from "../../types/auth";
import type {
  CreateProductBody,
  ProductAmountQuery,
  ProductQuery,
  UpdateProductBody,
} from "./productValidator";

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

/** GET /product/:id：仅返回指定字段，img 拼 PUBLIC_BASE_URL 前缀 */
export async function getProductById(db: TenantPrismaClient, id: number) {
  const res = await db.product.findUnique({
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
    },
  });
  if (res?.img) {
    // 未配置 PUBLIC_BASE_URL 时按空前缀处理（老架构会拼出 "undefined/..."）
    res.img = `${process.env.PUBLIC_BASE_URL ?? ""}${res.img}`;
  }
  return new SuccessResponse(res, "产品信息查询成功");
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
  const { name, remark, vendorId, salePrice, img, desc } = body;

  const productExisted = await db.product.findFirst({
    where: { name, vendorId },
  });
  if (productExisted) {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, "产品已存在");
  }

  const product = await db.product.create({
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

  const { salePrice, name, remark, img, desc } = body;
  const product = await db.product.update({
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
