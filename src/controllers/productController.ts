import prisma from "../utils/prisma";
import { SuccessResponse } from "../models/Response";
import { getPaginationValues, getWhereValues } from "../utils/db";
import {
  ProductQuery,
  CreateProductBody,
  UpdateProductBody,
  ProductByVendorParams,
} from "../validators/productValidator";
import { UpdateId } from "../validators/commonValidator";

// 获取产品列表
export const getProducts = async ({ query }: { query: ProductQuery }) => {
  const { limit, page, productName, pagination = true } = query;
  let skip = undefined,
    take = undefined;
  if (pagination) {
    const paginationInfo = getPaginationValues({ limit, page });
    skip = paginationInfo.skip;
    take = paginationInfo.take;
  }

  // 查询条件
  const whereValues = getWhereValues({ name: productName });
  const products = await prisma.product.findMany({
    skip,
    take,
    where: whereValues,
    include: {
      Vendor: true,
      historyCost: true,
    },
  });
  const total = await prisma.product.count({ where: whereValues });

  return JSON.stringify(
    new SuccessResponse({ total, list: products }, "产品列表获取成功"),
  );
};

// 根据ID获取产品
export const getProductById = async ({ params }: { params: UpdateId }) => {
  const res = await prisma.product.findUnique({
    where: {
      id: params.id,
    },
    select: {
      historyCost: true,
      name: true,
      img: true,
      balance: true,
      vendorId: true,
      remark: true,
      latestCost: true,
      latestPrice: true,
    },
  });
  return JSON.stringify(new SuccessResponse(res, "产品信息查询成功"));
};

// 创建产品
export const createProduct = async ({ body }: { body: CreateProductBody }) => {
  const { name, remark, vendorId, shelfPrice } = body;
  const product = await prisma.product.create({
    data: {
      name,
      remark,
      vendorId,
      shelfPrice,
    },
  });
  return JSON.stringify(new SuccessResponse(product, "产品创建成功"));
};

// 更新产品
export const updateProduct = async ({
  params,
  body,
}: {
  params: UpdateId;
  body: UpdateProductBody;
}) => {
  const { price, cost, name, remark, img } = body;
  const product = await prisma.product.update({
    where: {
      id: params.id,
    },
    data: {
      name,
      cost,
      remark,
      img,
      price,
    },
  });
  return JSON.stringify(new SuccessResponse(product, "产品更新成功"));
};

// 根据供应商ID获取产品列表
export const getProductsByVendorId = async ({
  params,
}: {
  params: ProductByVendorParams;
}) => {
  const { vendorId } = params;
  const products = await prisma.product.findMany({
    where: {
      vendorId,
    },
  });
  const total = await prisma.product.count({
    where: {
      vendorId,
    },
  });
  return JSON.stringify(
    new SuccessResponse({ total, list: products }, "产品列表获取成功"),
  );
};
