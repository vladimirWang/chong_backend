import type { TenantPrismaClient } from "../../utils/prisma";
import { getPaginationValues, getWhereValues } from "../../utils/db";
import { auditCreateConnect, auditUpdate } from "../../utils/auditUser";
import {
  ErrorResponse,
  SuccessResponse,
  errorCode,
} from "../../models/Response";
import { HttpError } from "../../models/HttpError";
import type { AuthUser } from "../../types/auth";
import type {
  CreateVendorBody,
  UpdateVendorBody,
  VendorQuery,
} from "./vendorValidator";

/**
 * 供应商业务层（移植自 repo_backend vendorController + vendorRouter 内联逻辑）
 * 所有函数第一个参数为租户级 prisma（authMiddleware 注入，自动 tenantId 隔离 + 软删除过滤）
 */

/** GET /vendor：分页列表（name 模糊） */
export async function getVendors(db: TenantPrismaClient, query: VendorQuery) {
  const { limit = 10, page = 1, name, pagination = true } = query;
  const { skip, take } = getPaginationValues({ limit, page });
  const whereValues = getWhereValues({ name });

  const list = await db.vendor.findMany({
    skip: pagination ? skip : undefined,
    take: pagination ? take : undefined,
    where: { ...whereValues },
  });
  const total = await db.vendor.count({ where: whereValues });

  return new SuccessResponse({ total, list }, "供应商列表获取成功");
}

/** GET /vendor/:id */
export async function getVendorById(db: TenantPrismaClient, id: number) {
  const vendor = await db.vendor.findUnique({ where: { id } });
  if (!vendor) {
    throw new HttpError(404, 10006, "没有查到供应商信息");
  }
  return new SuccessResponse(vendor, "供应商获取成功");
}

/** POST /vendor：创建（租户内名称唯一） */
export async function createVendor(
  db: TenantPrismaClient,
  user: AuthUser,
  body: CreateVendorBody,
) {
  if (!user.tenantId) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "当前用户未绑定租户");
  }
  const { name, remark } = body;

  const vendorExisted = await db.vendor.findFirst({ where: { name } });
  if (vendorExisted) {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, "品牌名已存在");
  }

  const vendor = await db.vendor.create({
    // tenant 由 tenantPrisma 的 create 扩展在运行时自动 connect 注入（类型层不感知，需 cast）
    data: {
      name,
      remark: remark ?? null,
      ...auditCreateConnect(user.userId),
    } as never,
  });
  return new SuccessResponse(vendor, "供应商创建成功");
}

/** GET /vendor/byId/:id：供应商及其产品 */
export async function getVendorWithProducts(
  db: TenantPrismaClient,
  id: number,
) {
  const vendor = await db.vendor.findUnique({
    where: { id },
    include: { products: true },
  });
  return new SuccessResponse(vendor, "供应商获取成功");
}

/** DELETE /vendor/:id：有关联产品则禁止删除 */
export async function deleteVendor(db: TenantPrismaClient, id: number) {
  // 存在性（老架构 beforeHandle，缺失按校验失败 400）
  const vendor = await db.vendor.findUnique({ where: { id } });
  if (!vendor) {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, "供应商不存在");
  }

  const products = await db.product.findMany({
    where: { vendorId: id },
    select: { id: true },
  });
  if (products.length > 0) {
    throw new HttpError(
      409,
      errorCode.VENDOR_HAS_PRODUCTS,
      "该供应商有关联产品，无法删除",
    );
  }

  await db.vendor.delete({ where: { id } });
  return new SuccessResponse(null, "供应商删除成功");
}

/** DELETE /vendor/batch：部分失败时返回 deleted/cannotDelete/notFound 明细 */
export async function batchDeleteVendors(
  db: TenantPrismaClient,
  vendorIds: number[],
) {
  if (vendorIds.length === 0) {
    throw new HttpError(400, errorCode.VALIDATION_ERROR, "请至少选择一个供应商");
  }

  // 只查当前租户下的这些供应商（跨租户的选不出来，也就删不掉）
  const vendors = await db.vendor.findMany({
    where: { id: { in: vendorIds } },
    select: { id: true },
  });
  const existingVendorIds = vendors.map((v) => v.id);
  const notFoundIds = vendorIds.filter((id) => !existingVendorIds.includes(id));

  // 当前租户下哪些供应商有关联产品
  const vendorsWithProducts = await db.product.findMany({
    where: { vendorId: { in: existingVendorIds } },
    select: { vendorId: true },
    distinct: ["vendorId"],
  });
  const vendorIdsWithProducts = vendorsWithProducts.map((p) => p.vendorId);
  const vendorIdsCanDelete = existingVendorIds.filter(
    (id) => !vendorIdsWithProducts.includes(id),
  );

  if (vendorIdsCanDelete.length === 0 && vendorIdsWithProducts.length > 0) {
    throw new HttpError(
      409,
      errorCode.VENDOR_HAS_PRODUCTS,
      "所有选中的供应商都有关联产品，无法删除",
    );
  }

  if (vendorIdsCanDelete.length > 0) {
    await db.vendor.deleteMany({
      where: { id: { in: vendorIdsCanDelete } },
    });
  }

  // 部分删不掉：207 语义更准，但保持与老架构一致用 409
  if (vendorIdsWithProducts.length > 0) {
    throw new HttpError(
      409,
      errorCode.VENDOR_HAS_PRODUCTS,
      "部分供应商有关联产品，无法删除",
      {
        deleted: vendorIdsCanDelete,
        cannotDelete: vendorIdsWithProducts,
        notFound: notFoundIds,
      },
    );
  }

  if (vendorIdsCanDelete.length > 0) {
    return new SuccessResponse(
      { deleted: vendorIdsCanDelete, notFound: notFoundIds },
      "供应商批量删除成功",
    );
  }

  throw new HttpError(404, errorCode.NOT_FOUND, "所有选中的供应商都不存在");
}

/** PUT /vendor/:id */
export async function updateVendor(
  db: TenantPrismaClient,
  userId: number,
  id: number,
  body: UpdateVendorBody,
) {
  const { name, remark } = body;
  const updatedVendor = await db.vendor.update({
    where: { id },
    // undefined 字段 Prisma 会忽略（保持原值），与老架构一致；不能 ?? null，否则未传时会被清空
    data: {
      name,
      remark,
      ...auditUpdate(userId),
    },
  });
  return new SuccessResponse(updatedVendor, "供应商更新成功");
}
