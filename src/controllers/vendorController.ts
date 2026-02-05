import prisma from "../utils/prisma";
import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import { getPaginationValues, getWhereValues } from "../utils/db";
import { VendorQuery, vendorBatchDeleteSchema, VendorBatchDelete } from "../validators/vendorValidator";
import {getBeijingStartOfDay, getBeijingEndOfDay} from '../utils/date'
import {UpdateId} from '../validators/commonValidator'

export const getVendors = async ({
  query,
  status,
  headers: { authorization },
}: {
  query: VendorQuery;
  status?: any;
  headers: { authorization?: string };
}) => {
  const { limit = 10, page = 1, name, pagination = true, deletedAt } = query;
  const { skip, take } = getPaginationValues({ limit, page });
  // 查询条件
  const whereValues = getWhereValues({ name });
  const vendors = await prisma.vendor.findMany({
    skip: pagination ? skip : undefined,
    take: pagination ? take : undefined,
    where: {
        ...whereValues,
        // deletedAt: deletedAt instanceof Date? {
        //     lte: getBeijingEndOfDay(deletedAt),
        //     gte: getBeijingStartOfDay(deletedAt)
        // }: (typeof deletedAt === 'boolean' ?  {
        //     not: null
        // }: undefined)
    },
  });
  const total = await prisma.vendor.count({ where: whereValues });

  return new SuccessResponse({ total, list: vendors }, "供应商列表获取成功")
};

// 删除供应商
export const deleteVendor = async ({
  params,
  status,
}: {
  params: UpdateId;
  status: any;
}) => {
  // 检查是否有关联产品
  const products = await prisma.product.findMany({
    where: {
      vendorId: params.id,
    },
    select: {
      id: true,
    },
  });

  if (products.length > 0) {
    // 如果有关联产品，返回409状态码
    const result = new ErrorResponse(
      errorCode.VENDOR_HAS_PRODUCTS,
      "该供应商有关联产品，无法删除"
    );
    return status(409, JSON.stringify(result));
  }

  // 删除供应商
  await prisma.vendor.delete({
    where: {
      id: params.id,
    },
  });

  return new SuccessResponse(null, "供应商删除成功")
};

// 批量删除供应商
export const batchDeleteVendor = async ({
  body,
  status,
}: {
  body: VendorBatchDelete;
  status: any;
}) => {
  const { id: vendorIds } = body;

  // 如果数组为空，直接返回错误
  if (vendorIds.length === 0) {
    const result = new ErrorResponse(
      errorCode.VALIDATION_ERROR,
      "请至少选择一个供应商"
    );
    return status(400, JSON.stringify(result));
  }

  // 查询所有要删除的供应商是否存在
  const vendors = await prisma.vendor.findMany({
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

  // 查询哪些供应商有关联产品
  const vendorsWithProducts = await prisma.product.findMany({
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
    (id) => !vendorIdsWithProducts.includes(id)
  );

  // 如果所有供应商都有关联产品，返回409错误
  if (vendorIdsCanDelete.length === 0 && vendorIdsWithProducts.length > 0) {
    const result = new ErrorResponse(
      errorCode.VENDOR_HAS_PRODUCTS,
      "所有选中的供应商都有关联产品，无法删除"
    );
    return status(409, JSON.stringify(result));
  }

  // 执行批量删除（删除所有可以删除的供应商）
  if (vendorIdsCanDelete.length > 0) {
    await prisma.vendor.deleteMany({
      where: {
        id: {
          in: vendorIdsCanDelete,
        },
      },
    });
  }

  // 如果有部分供应商有关联产品，返回详细信息（部分成功）
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

  // 如果所有供应商都没有关联产品，返回成功
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

  // 如果所有供应商都不存在
  const result = new ErrorResponse(
    errorCode.NOT_FOUND,
    "所有选中的供应商都不存在"
  );
  return status(404, JSON.stringify(result));
};