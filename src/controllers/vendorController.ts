import prisma, { TenantPrismaClient } from "../utils/prisma";
import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import { getPaginationValues, getWhereValues } from "../utils/db";
import {
  VendorQuery,
  vendorBatchDeleteSchema,
  VendorBatchDelete,
} from "../validators/vendorValidator";
import { getBeijingStartOfDay, getBeijingEndOfDay } from "../utils/date";
import { UpdateId } from "../validators/commonValidator";

type VendorCtx = {
  query: VendorQuery;
  status?: any;
  /** 注入的租户级 prisma（tenantId 自动过滤） */
  tenantPrisma: TenantPrismaClient;
};

export const getVendors = async ({
  query,
  status,
  tenantPrisma,
}: VendorCtx) => {
  const { limit = 10, page = 1, name, pagination = true, deletedAt } = query;
  const { skip, take } = getPaginationValues({ limit, page });
  // 查询条件
  const whereValues = getWhereValues({ name });
  const vendors = await tenantPrisma.vendor.findMany({
    skip: pagination ? skip : undefined,
    take: pagination ? take : undefined,
    where: {
      ...whereValues,
    },
  });
  const total = await tenantPrisma.vendor.count({ where: whereValues });

  return new SuccessResponse({ total, list: vendors }, "供应商列表获取成功");
};

type DeleteCtx = {
  params: UpdateId;
  status: any;
  tenantPrisma: TenantPrismaClient;
};

// 删除供应商
export const deleteVendor = async ({
  params,
  status,
  tenantPrisma,
}: DeleteCtx) => {
  // 检查是否有关联产品（Product 也是租户表，用 tenantPrisma 自动过滤同租户）
  const products = await tenantPrisma.product.findMany({
    where: {
      vendorId: params.id,
    },
    select: {
      id: true,
    },
  });

  if (products.length > 0) {
    const result = new ErrorResponse(
      errorCode.VENDOR_HAS_PRODUCTS,
      "该供应商有关联产品，无法删除",
    );
    return status(409, JSON.stringify(result));
  }

  // 删除供应商（tenantPrisma 自动加 tenantId 条件，避免跨租户删）
  const deleted = await tenantPrisma.vendor.delete({
    where: {
      id: params.id,
    },
  });
  if (!deleted) {
    return status(404, JSON.stringify(new ErrorResponse(10006, "没有查到供应商信息")));
  }

  return new SuccessResponse(null, "供应商删除成功");
};

type BatchDeleteCtx = {
  body: VendorBatchDelete;
  status: any;
  tenantPrisma: TenantPrismaClient;
};

// 批量删除供应商
export const batchDeleteVendor = async ({
  body,
  status,
  tenantPrisma,
}: BatchDeleteCtx) => {
  const { id: vendorIds } = body;

  if (vendorIds.length === 0) {
    const result = new ErrorResponse(
      errorCode.VALIDATION_ERROR,
      "请至少选择一个供应商",
    );
    return status(400, JSON.stringify(result));
  }

  // 只查当前租户下的这些供应商（跨租户的不会被选出来，也就不会被删）
  const vendors = await tenantPrisma.vendor.findMany({
    where: {
      id: {
        in: vendorIds,
      },
    },
    select: {
      id: true,
    },
  });

  const existingVendorIds = vendors.map((v) => v.id);
  const notFoundIds = vendorIds.filter((id) => !existingVendorIds.includes(id));

  // 当前租户下哪些供应商有关联产品
  const vendorsWithProducts = await tenantPrisma.product.findMany({
    where: {
      vendorId: {
        in: existingVendorIds,
      },
    },
    select: {
      vendorId: true,
    },
    distinct: ["vendorId"],
  });

  const vendorIdsWithProducts = vendorsWithProducts.map((p) => p.vendorId);
  const vendorIdsCanDelete = existingVendorIds.filter(
    (id) => !vendorIdsWithProducts.includes(id),
  );

  if (vendorIdsCanDelete.length === 0 && vendorIdsWithProducts.length > 0) {
    const result = new ErrorResponse(
      errorCode.VENDOR_HAS_PRODUCTS,
      "所有选中的供应商都有关联产品，无法删除",
    );
    return status(409, JSON.stringify(result));
  }

  if (vendorIdsCanDelete.length > 0) {
    await tenantPrisma.vendor.deleteMany({
      where: {
        id: {
          in: vendorIdsCanDelete,
        },
      },
    });
  }

  if (vendorIdsWithProducts.length > 0) {
    const result = {
      code: errorCode.VENDOR_HAS_PRODUCTS,
      message: "部分供应商有关联产品，无法删除",
      data: {
        deleted: vendorIdsCanDelete,
        cannotDelete: vendorIdsWithProducts,
        notFound: notFoundIds,
      },
    };
    return status(409, JSON.stringify(result));
  }

  if (vendorIdsCanDelete.length > 0) {
    const result = {
      code: 200,
      message: "供应商批量删除成功",
      data: {
        deleted: vendorIdsCanDelete,
        notFound: notFoundIds,
      },
    };
    return JSON.stringify(result);
  }

  const result = new ErrorResponse(
    errorCode.NOT_FOUND,
    "所有选中的供应商都不存在",
  );
  return status(404, JSON.stringify(result));
};
