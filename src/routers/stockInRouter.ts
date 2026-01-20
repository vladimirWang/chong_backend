import { Elysia } from "elysia";
import prisma from "../utils/prisma";
import { jwt } from "@elysiajs/jwt";
import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import { z, ZodError } from "zod";
const { JWT_SECRET } = process.env;
import {
  singleStockInBodySchema,
  multipleStockInBodySchema,
  stockInParamsSchema,
} from "../validators/stockInValidator";
import {
  getStockIns,
  createSingleStockIn,
  createMultipleStockIn,
  getStockInById,
} from "../controllers/stockInController";


export const stockInRouter = new Elysia()
  // .use(
  //   jwt({
  //     name: "jwt",
  //     secret: JWT_SECRET!,
  //   })
  // )
  .group("/api/stockin", (app) => {
    return app
      // GET /api/stockin - 获取进货记录列表
      .get("/", getStockIns)
      // POST /api/stockin/single - 单个产品进货
      .post(
        "/single",
        createSingleStockIn,
        {
          body: singleStockInBodySchema,
          beforeHandle: async ({ body }) => {
            const productExisted = await prisma.product.findUnique({
              where: {
                id: body.productId,
              },
            });

            if (!productExisted) {
              // 抛出 zod 异常，使用自定义错误消息
              throw new ZodError([
                {
                  code: "custom",
                  path: ["productId"],
                  message: "产品不存在",
                },
              ]);
            }
          },
        }
      )
      // POST /api/stockin/multiple - 批量产品进货
      .post(
        "/multiple",
        createMultipleStockIn,
        {
          body: multipleStockInBodySchema,
          beforeHandle: async ({ body }) => {
            // 验证所有产品是否存在
            const productIds = body.joinData.map((item) => item.productId);
            const uniqueProductIds = [...new Set(productIds)];

            const existingProducts = await prisma.product.findMany({
              where: {
                id: {
                  in: uniqueProductIds,
                },
              },
              select: {
                id: true,
              },
            });

            const existingProductIds = existingProducts.map(
              (p: { id: number }) => p.id
            );
            const missingProductIds = uniqueProductIds.filter(
              (id) => !existingProductIds.includes(id)
            );

            if (missingProductIds.length > 0) {
              throw new ZodError([
                {
                  code: "custom",
                  path: ["productId"],
                  message: `产品不存在: ${missingProductIds.join(", ")}`,
                },
              ]);
            }
          },
        }
      )
      // GET /api/stockin/:id - 根据ID获取进货记录
      .get("/:id", getStockInById, {
        params: stockInParamsSchema,
      })
  });
