import { Elysia } from "elysia";
import prisma from "../utils/prisma";
import { jwt } from "@elysiajs/jwt";
import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import { z, ZodError } from "zod";
const { JWT_SECRET } = process.env;
import {
  singleStockInBodySchema,
  multipleStockInBodySchema,
  // stockInUpdateParamsSchema,
  mutilpleProductExistedValidator
} from "../validators/stockInValidator";
import {
  getStockIns,
  createSingleStockIn,
  createMultipleStockIn,
  getStockInById,
  updateStockIn,
  confirmCompleted
} from "../controllers/stockInController";
import {updateIdSchema} from '../validators/commonValidator'


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
          beforeHandle: mutilpleProductExistedValidator,
        }
      )
      // GET /api/stockin/:id - 根据ID获取进货记录
      .get("/:id", getStockInById, {
        params: updateIdSchema,
      })
      .put("/:id", updateStockIn, {
        params: updateIdSchema,
        body: multipleStockInBodySchema,
        // beforeHandle: mutilpleProductExistedValidator,
      }).patch("/confirmCompleted/:id", confirmCompleted, {
        params: updateIdSchema,
      })
  });
