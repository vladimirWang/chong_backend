import prisma from "../utils/prisma";
import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import { getPaginationValues, getWhereValues } from "../utils/db";
import { VendorQuery } from "../validators/vendorValidator";

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
