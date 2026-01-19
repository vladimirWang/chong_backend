import { Elysia } from "elysia";
import prisma from "../utils/prisma";
import { jwt } from "@elysiajs/jwt";
import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import { z, ZodError } from "zod";
const { JWT_SECRET } = process.env;
import { IProduct } from "../models/Product";


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
            const {productId, cost, count, remark} = body;
          const res = await prisma.StockIn.create({
            data: {
                remark,
              totalCost: cost * count,
              productJoinStockIn: {
                create: [
                  {
                    cost,
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
            cost: z.number(),
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
      .post(
        "/multiple",
        async ({ body }) => {
          const totalCost = body.joinData.reduce((a, c) => {
            return a+c.cost * c.count;
          }, 0)
          const results = await prisma.$transaction([
            // 创建进库记录
            prisma.StockIn.create({
              data: {
                remark: body.remark,
                totalCost,
                productJoinStockIn: {
                  create: body.joinData.map(item => {
                    return {
                      cost: item.cost,
                      count: item.count,
                      product: {
                        connect: {
                          id: item.productId,
                        },
                      },
                    }
                  })
                }
              }
            }),
            // 修改库存
            ...(body.joinData.map(item => {
              return prisma.Product.update({
                data: {
                  balance: {
                    increment: item.count
                    // increment: 5
                  }
                },
                where: {
                  id: item.productId
                  // id: 4
                }
              })
            }))
          ]);
          return JSON.stringify(new SuccessResponse(results, "进货记录批量新建成功"));
        },
        {
          body: z.object({
            remark: z.string().optional(),
            joinData: z.array(
              z.object({
                count: z.number(),
                cost: z.number(),
                productId: z.number(),

              })
            ),
          }),
          beforeHandle: async ({ body }) => {
            // 验证所有产品是否存在
            const productIds = body.joinData.map((item) => item.productId);
            const uniqueProductIds = [...new Set(productIds)];
            
            const existingProducts = await prisma.Product.findMany({
              where: {
                id: {
                  in: uniqueProductIds,
                },
              },
              select: {
                id: true,
              },
            });

            const existingProductIds = existingProducts.map((p) => p.id);
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
  });
