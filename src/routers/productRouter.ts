import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { z, ZodError } from "zod";
import prisma from "../utils/prisma";
import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import {
  productQuerySchema,
  createProductBodySchema,
  updateProductBodySchema,
  productByVendorParamsSchema,
} from "../validators/productValidator";
import {
  updateIdSchema,
  vendorIdSchema,
  productNameStringSchema,
} from "../validators/commonValidator";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  getProductsByVendorId,
  getLatestShelfPriceByProductId,
  checkProductNameExistedInVendor,
} from "../controllers/productController";
const { JWT_SECRET } = process.env;

// 供应商相关路由模块
export const productRouter = new Elysia({
  prefix: "/product",
})
  .get("/", getProducts, {
    query: productQuerySchema,
  })
  // GET /nodejs_api/product/:id - 根据ID获取产品
  .get("/:id", getProductById, {
    params: updateIdSchema,
  })
  // POST /nodejs_api/product - 创建产品
  .post("/", createProduct, {
    body: createProductBodySchema,
    beforeHandle: async ({ body }) => {
      // 检查产品是否已存在
      const productExisted = await prisma.product.findFirst({
        where: {
          name: body.name,
          vendorId: body.vendorId,
        },
      });

      if (productExisted) {
        // 抛出 zod 异常，使用自定义错误消息
        throw new ZodError([
          {
            code: "custom",
            path: ["name", "vendorId"],
            message: "产品已存在",
          },
        ]);
      }
    },
  })
  // PATCH /nodejs_api/product/:id - 更新产品
  .patch("/:id", updateProduct, {
    params: updateIdSchema,
    body: updateProductBodySchema,
    beforeHandle: async ({ params }) => {
      const productExisted = await prisma.product.findUnique({
        where: {
          id: params.id,
        },
      });

      if (!productExisted) {
        // 抛出 zod 异常，使用自定义错误消息
        throw new ZodError([
          {
            code: "custom",
            path: ["id"],
            message: "产品不存在",
          },
        ]);
      }
    },
  })
  // DELETE /nodejs_api/product/:id - 删除产品
  .delete(
    "/:id",
    ({ params }) => {
      return {
        message: `产品 ${params.id} 删除成功`,
      };
    },
    {
      params: updateIdSchema,
    },
  )
  // GET /nodejs_api/product/getProductsByVendorId/:vendorId - 根据供应商ID获取产品列表
  .get("/getProductsByVendorId/:vendorId", getProductsByVendorId, {
    params: productByVendorParamsSchema,
  })
  .get("/getLatestShelfPriceByProductId/:id", getLatestShelfPriceByProductId, {
    params: updateIdSchema,
  })
  .get(
    "/checkProductNameExistedInVendor/:vendorId",
    checkProductNameExistedInVendor,
    {
      params: vendorIdSchema,
      query: productNameStringSchema,
    },
  );
