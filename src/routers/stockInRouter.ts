import { Elysia } from "elysia";
import prisma from "../utils/prisma";
import { jwt } from "@elysiajs/jwt";
import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import { z, ZodError } from "zod";
const { JWT_SECRET } = process.env;
import { IProduct } from "../models/Product";
import { luhn } from "../utils/algo";


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
          
          // 查询所有产品信息（包括 vendorId）
          const productIds = body.joinData.map((item) => item.productId);
          const uniqueProductIds = [...new Set(productIds)];
          const products = await prisma.Product.findMany({
            where: {
              id: {
                in: uniqueProductIds,
              },
            },
            select: {
              id: true,
              vendorId: true,
            },
          });

          // 创建产品 id 到产品信息的映射
          const productMap = new Map<number, IProduct>(products.map((p: { id: number; vendorId: number | null }) => [p.id, p]));

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
            // 修改库存并生成产品编码
            ...(body.joinData.map(item => {
              const product = productMap.get(item.productId);
              // 如果产品存在且有 vendorId，生成产品编码
              const updateData: {
                balance: { increment: number };
                productCode?: string;
                latestCost?: number;
              } = {
                balance: {
                  increment: item.count
                },
                latestCost: item.cost
              };
              
              // TODO 正确处理判空
              const productCode = luhn(product!);
              updateData.productCode = productCode;
              
              return prisma.Product.update({
                data: updateData,
                where: {
                  id: item.productId
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

            const existingProductIds = existingProducts.map((p: { id: number }) => p.id);
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
      .get("/:id", async ({ params }) => {
        const { id } = params;
        const result = await prisma.StockIn.findUnique({
          where: {
            id,
          },
          select: {
            remark: true,
            productJoinStockIn: true
          }
        });
        return JSON.stringify(new SuccessResponse(result, "进货记录查询成功"));
      }, {
        params: z.object({
          id: z.coerce.number(),
        }),
      })
  });
