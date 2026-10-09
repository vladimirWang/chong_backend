import type { TenantPrismaClient } from "../../utils/prisma";
import { getWhereValues } from "../../utils/db";
import { auditCreateConnect } from "../../utils/auditUser";
import { SuccessResponse, errorCode } from "../../models/Response";
import { HttpError } from "../../models/HttpError";
import type { AuthUser } from "../../types/auth";
import type {
  CreateAttrBody,
  CreateAttrCategoryBody,
  AttrListQuery,
} from "./attrValidator";

/**
 * 属性 / 属性分类业务层（租户内字典，tenantPrisma 自动租户隔离）
 */

/** GET /attr/category：分类列表（按 id 升序） */
export async function getAttrCategories(db: TenantPrismaClient) {
  const list = await db.attrCategory.findMany({
    orderBy: { id: "asc" },
  });
  return new SuccessResponse({ list }, "属性分类列表获取成功");
}

/** POST /attr/category：创建分类（租户内名称唯一） */
export async function createAttrCategory(
  db: TenantPrismaClient,
  user: AuthUser,
  body: CreateAttrCategoryBody,
) {
  if (!user) {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, "未登录");
  }
  const { name } = body;

  const existed = await db.attrCategory.findFirst({ where: { name } });
  if (existed) {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, "属性分类已存在");
  }

  const attrCategory = await db.attrCategory.create({
    data: {
      name,
      ...auditCreateConnect(user.userId),
    } as never,
  });
  return new SuccessResponse(attrCategory, "属性分类创建成功");
}

/** GET /attr：属性列表，可按分类 id 集合过滤、按名称模糊 */
export async function getAttrs(db: TenantPrismaClient, query: AttrListQuery) {
  const { categoryIds, attrName } = query;

  const idList = (categoryIds ?? "")
    .split(",")
    .map(s => Number(s.trim()))
    .filter(n => Number.isInteger(n) && n > 0);

  const list = await db.attr.findMany({
    where: {
      ...(idList.length > 0 ? { attrCategoryId: { in: idList } } : {}),
      ...getWhereValues({ name: attrName }),
    },
    include: { attrCategory: true },
    orderBy: [{ attrCategoryId: "asc" }, { id: "asc" }],
  });
  return new SuccessResponse({ list }, "属性列表获取成功");
}

/** POST /attr：创建属性（同租户同分类下名称唯一，分类须存在） */
export async function createAttr(
  db: TenantPrismaClient,
  user: AuthUser,
  body: CreateAttrBody,
) {
  if (!user) {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, "未登录");
  }
  const { name, attrCategoryId } = body;

  const category = await db.attrCategory.findUnique({
    where: { id: attrCategoryId },
  });
  if (!category) {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, "属性分类不存在");
  }

  const existed = await db.attr.findFirst({
    where: { name, attrCategoryId },
  });
  if (existed) {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, "该分类下属性已存在");
  }

  const attr = await db.attr.create({
    data: {
      name,
      attrCategory: { connect: { id: attrCategoryId } },
      ...auditCreateConnect(user.userId),
    } as never,
  });
  return new SuccessResponse(attr, "属性创建成功");
}
