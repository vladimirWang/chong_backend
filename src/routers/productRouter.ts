import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { z, ZodError } from "zod";
import prisma from "../utils/prisma";
import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import {
  productQuerySchema,
  createProductBodySchema,
  updateProductBodySchema,
  productParamsSchema,
  productByVendorParamsSchema,
} from "../validators/productValidator";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  getProductsByVendorId,
} from "../controllers/productController";
const { JWT_SECRET } = process.env;

// 供应商相关路由模块
export const productRouter = new Elysia()
  .group("/api/product", {
    isSignIn: true
  }, (app) => {
    return (
      app
        // GET /api/product - 获取产品列表
        .get("/", getProducts, {
          query: productQuerySchema,
          
        })
        // GET /api/product/:id - 根据ID获取产品
        .get("/:id", getProductById, {
          params: productParamsSchema,
        })
        // POST /api/product - 创建产品
        .post(
          "/",
          createProduct,
          {
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
          }
        )
        // PATCH /api/product/:id - 更新产品
        .patch(
          "/:id",
          updateProduct,
          {
            params: productParamsSchema,
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
          }
        )
        // DELETE /api/product/:id - 删除产品
        .delete("/:id", ({ params }) => {
          return {
            message: `产品 ${params.id} 删除成功`,
          };
        }, {
          params: productParamsSchema,
        })
        // GET /api/product/getProductsByVendorId/:vendorId - 根据供应商ID获取产品列表
        .get("/getProductsByVendorId/:vendorId", getProductsByVendorId, {
          params: productByVendorParamsSchema,
        })
    );
  });
