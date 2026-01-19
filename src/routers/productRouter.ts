import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { z, ZodError } from "zod";
import prisma from "../utils/prisma";
import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import { getPaginationValues, getWhereValues } from "../utils/db";

const { JWT_SECRET } = process.env;

// 供应商相关路由模块
export const productRouter = new Elysia()
  .group("/api/product", (app) => {
    return (
      app
        // GET /api/posts - 获取文章列表
        .get(
          "/",
          async ({ query, status, headers: { authorization } }) => {
            const { limit, page, name, pagination = true } = query;
            let skip = undefined, take = undefined;
            if (pagination) {
              const paginationInfo = getPaginationValues({ limit, page });
              skip = paginationInfo.skip;
              take = paginationInfo.take;
            }

            // 查询条件
            const whereValues = getWhereValues({ name });
            const products = await prisma.Product.findMany({
              skip,
              take,
              where: whereValues,
              include: {
                Vendor: true,
              },
            });
            const total = await prisma.Product.count({ where: whereValues });

            return JSON.stringify(
              new SuccessResponse({ total, list: products }, "产品列表获取成功")
            );
          },
          {
            query: z.object({
              limit: z.coerce.number().optional(),
              page: z.coerce.number().optional(),
              name: z.string().optional(),
            }),
            // auth: true
          }
        )
        .get(
          "/:id",
          async ({ params, status, cookie: { auth } }) => {
            const res = await prisma.Product.findUnique({
              where: {
                id: params.id,
              },
            });
            return JSON.stringify(new SuccessResponse(res, "产品信息查询成功"));
          },
          {
            params: z.object({
              id: z.coerce.number(),
            }),
          }
        )
        // POST /api/posts - 创建产品
        .post(
          "/",
          async ({ body }) => {
            const { name, remark, vendorId } = body;
            const vendor = await prisma.Product.create({
              data: {
                name,
                remark,
                vendorId,
              },
            });
            return JSON.stringify(
              new SuccessResponse<string>(vendor, "供应商创建成功")
            );
          },
          {
            body: z.object({
              name: z.string().min(2),
              remark: z.string().max(255).optional(),
              vendorId: z.coerce.number(),
            }),
            beforeHandle: async ({ body }) => {
              // 检查品牌是否已存在
              const userExisted = await prisma.Product.findFirst({
                where: {
                  name: body.name,
                  vendorId: body.vendorId,
                },
              });

              if (userExisted) {
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
        .patch(
          "/:id",
          async ({ params, body }) => {
            const { price, cost, name, remark, img } = body;
            const product = await prisma.Product.update({
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
            return JSON.stringify(
              new SuccessResponse<string>(product, "产品更新成功")
            );
          },
          {
            params: z.object({
              id: z.coerce.number(),
            }),
            body: z.object({
              price: z.number().optional(),
              cost: z.number().optional(),
              name: z.string().optional(),
              remark: z.string().optional(),
              img: z.string().optional(),
            }),
            beforeHandle: async ({ params }) => {
              const productExisted = await prisma.Product.findUnique({
                where: {
                  id: params.id,
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
          }
        )
        .delete("/:id", ({ params }) => {
          return {
            message: `文章 ${params.id} 删除成功`,
          };
        })
        // 根据供应商id获取产品列表
        .get("/getProductsByVendorId/:vendorId", async ({ params }) => {
          const { vendorId } = params;
          const products = await prisma.Product.findMany({
            where: {
              vendorId,
            },
          });
          const total = await prisma.Product.count({
            where: {
              vendorId,
            },
          });
          return JSON.stringify(new SuccessResponse({total, list: products}, "产品列表获取成功"));
        }, {
          params: z.object({
            vendorId: z.coerce.number(),
          }),
        })
    );
  });
