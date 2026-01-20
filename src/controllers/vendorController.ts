import prisma from "../utils/prisma";
import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import { getPaginationValues, getWhereValues } from "../utils/db";
import { VendorQuery, VendorParams, vendorBatchDeleteSchema, VendorBatchDelete } from "../validators/vendorValidator";

export const getVendors = async ({
  query,
  status,
  headers: { authorization },
}: {
  query: VendorQuery;
  status?: any;
  headers: { authorization?: string };
}) => {
  const { limit = 10, page = 1, name, pagination = true } = query;
  const { skip, take } = getPaginationValues({ limit, page });

  // 查询条件
  const whereValues = getWhereValues({ name });
  const vendors = await prisma.vendor.findMany({
    skip: pagination ? skip : undefined,
    take: pagination ? take : undefined,
    where: whereValues,
  });
  const total = await prisma.vendor.count({ where: whereValues });

  return JSON.stringify(
    new SuccessResponse({ total, list: vendors }, "供应商列表获取成功"),
  );
};

// 删除供应商
export const deleteVendor = async ({
  params,
  status,
}: {
  params: VendorParams;
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

  return JSON.stringify(
    new SuccessResponse(null, "供应商删除成功")
  );
};

export const batchDeleteVendor = ({
    body
}: {
    body: VendorBatchDelete
}) => {
    
    return 'fff'
}