import { Elysia } from "elysia";
import prisma from "../utils/prisma";
import { jwt } from "@elysiajs/jwt";
import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import { z, ZodError } from "zod";
const { JWT_SECRET } = process.env;

export const stockInRouter = new Elysia()
  // .use(
  //   jwt({
  //     name: "jwt",
  //     secret: JWT_SECRET!,
  //   })
  // )
  .group("/api/stockin", (app) => {
    return app
      .get("/", async () => {
        const result = await prisma.StockIn.findMany()
        const total = await prisma.StockIn.count()
        return JSON.stringify(new SuccessResponse({list: result, total}, "进货记录新建成功"));
      })
      .post(
        "/single",
        async ({body}) => {
            const {productId, price, count, remark} = body;
          const res = await prisma.StockIn.create({
            data: {
                remark,
              totalPrice: price * count,
              productJoinStockIn: {
                create: [
                  {
                    price,
                    count,
                    product: {
                      connect: {
                        id: productId,
                      },
                    },
                  },
                ],
              },
            },
          });
          return JSON.stringify(new SuccessResponse(null, "进货记录新建成功"));
        },
        {
          body: z.object({
            count: z.number(),
            price: z.number(),
            productId: z.number(),
            remark: z.string().optional(),
          }),
          beforeHandle: async ({ body }) => {
            const productExisted = await prisma.Product.findUnique({
              where: {
                id: body.productId,
                // password: body.password
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
        },
      )
  });
