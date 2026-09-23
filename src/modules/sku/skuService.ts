import type { TenantPrismaClient } from "../../utils/prisma";
import { getWhereValues } from "../../utils/db";
import { auditCreateConnect } from "../../utils/auditUser";
import { SuccessResponse, errorCode } from "../../models/Response";
import { HttpError } from "../../models/HttpError";
import type { AuthUser } from "../../types/auth";
import type {
  CreateSkuBody,
  CreateSkuCategoryBody,
  SkuListQuery,
} from "./skuValidator";

/**
 * SKU / SKU 分类业务层（租户内字典，tenantPrisma 自动租户隔离）
 */

/** GET /sku/category：分类列表（按 id 升序） */
export async function getSkuCategories(db: TenantPrismaClient) {
  const list = await db.skuCategory.findMany({
    orderBy: { id: "asc" },
  });
  return new SuccessResponse({ list }, "SKU分类列表获取成功");
}

/** POST /sku/category：创建分类（租户内名称唯一） */
export async function createSkuCategory(
  db: TenantPrismaClient,
  user: AuthUser,
  body: CreateSkuCategoryBody,
) {
  if (!user) {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, "未登录");
  }
  const { name } = body;

  const existed = await db.skuCategory.findFirst({ where: { name } });
  if (existed) {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, "SKU分类已存在");
  }

  const skuCategory = await db.skuCategory.create({
    data: {
      name,
      ...auditCreateConnect(user.userId),
    } as never,
  });
  return new SuccessResponse(skuCategory, "SKU分类创建成功");
}

/** GET /sku：SKU 列表，可按分类 id 集合过滤、按名称模糊 */
export async function getSkus(db: TenantPrismaClient, query: SkuListQuery) {
  const { categoryIds, skuName } = query;

  const idList = (categoryIds ?? "")
    .split(",")
    .map(s => Number(s.trim()))
    .filter(n => Number.isInteger(n) && n > 0);

  const list = await db.sku.findMany({
    where: {
      ...(idList.length > 0 ? { skuCategoryId: { in: idList } } : {}),
      ...getWhereValues({ name: skuName }),
    },
    include: { skuCategory: true },
    orderBy: [{ skuCategoryId: "asc" }, { id: "asc" }],
  });
  return new SuccessResponse({ list }, "SKU列表获取成功");
}

/** POST /sku：创建 SKU（同租户同分类下名称唯一，分类须存在） */
export async function createSku(
  db: TenantPrismaClient,
  user: AuthUser,
  body: CreateSkuBody,
) {
  if (!user) {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, "未登录");
  }
  const { name, skuCategoryId } = body;

  const category = await db.skuCategory.findUnique({
    where: { id: skuCategoryId },
  });
  if (!category) {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, "SKU分类不存在");
  }

  const existed = await db.sku.findFirst({
    where: { name, skuCategoryId },
  });
  if (existed) {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, "该分类下SKU已存在");
  }

  const sku = await db.sku.create({
    data: {
      name,
      skuCategory: { connect: { id: skuCategoryId } },
      ...auditCreateConnect(user.userId),
    } as never,
  });
  return new SuccessResponse(sku, "SKU创建成功");
}
