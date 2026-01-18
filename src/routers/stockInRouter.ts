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
      .post(
        "/multiple",
        async ({ body }) => {
          const totalPrice = body.joinData.reduce((a, c) => {
            return a+c.price * c.count;
          }, 0)
          // 使用事务批量创建
          /**
            body.map((item: { productId: number; price: number; count: number; remark?: string }) => {
              return prisma.StockIn.create({
                data: {
                  remark: item.remark,
                  totalPrice: item.price * item.count,
                  productJoinStockIn: {
                    create: [
                      {
                        price: item.price,
                        count: item.count,
                        product: {
                          connect: {
                            id: item.productId,
                          },
                        },
                      },
                    ],
                  },
                },
              });
            })
           */
          //  productJoinStockIn
          const results = await prisma.$transaction([
            prisma.StockIn.create({
              data: {
                remark: body.remark,
                totalPrice,
                productJoinStockIn: {
                  create: body.joinData.map(item => {
                    return {
                      price: item.price,
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
            // body.map(item => {
            //   return prisma.ProductJoinStockIn.create({
            //     price: item.price,
            //     count: item.count,
            //     product: {
            //       connect: {
            //         id: item.productId
            //       }
            //     }
            //   })
            // })
            
          ]);
          return JSON.stringify(new SuccessResponse(results, "进货记录批量新建成功"));
        },
        {
          body: z.object({
            remark: z.string().optional(),
            joinData: z.array(
              z.object({
                count: z.number(),
                price: z.number(),
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
