import { Elysia } from "elysia";
import { jwt } from '@elysiajs/jwt'
import { z, ZodError } from "zod";
import prisma from "../utils/prisma";
import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import {getPaginationValues, getWhereValues} from '../utils/db';

const { JWT_SECRET } = process.env;

// 供应商相关路由模块
export const productRouter = new Elysia()
    .use(
        jwt({
            name: 'jwt',
            secret: JWT_SECRET!
        })
    )
    .group("/api/product", (app) => {
    return app
        // GET /api/posts - 获取文章列表
        .get("/", async (
            {query, jwt, status, headers: { authorization }}
        ) => {
            const { limit, page, name } = query;
            const {skip, take} = getPaginationValues({limit, page});

            // 查询条件
            const whereValues = getWhereValues({ name });
            const products = await  prisma.Product.findMany({
                skip,
                take,
                where: whereValues,
                include: {
                    Vendor: true
                }
            });
            const total = await prisma.Product.count({ where: whereValues });
            
            return JSON.stringify(new SuccessResponse({total, list: products}, "产品列表获取成功"));
        }, 
        {
            query: z.object({
                limit: z.coerce.number().optional(),
                page: z.coerce.number().optional(),
                name: z.string().optional()
            }),
        }
        )
        // GET /api/posts/:id - 获取单个文章
        .get("/:id", async ({ params, status, cookie: {auth} }) => {
            const product = await prisma.Product.findUnique({
                where: {
                    id: params.id
                }
            })
            
            return JSON.stringify(new SuccessResponse<string>(product, "产品查询成功"));
        }, {
            params: z.object({
                id: z.coerce.number()
            })
        })
        // POST /api/posts - 创建产品
        .post("/", async ({ body }) => {
            const {name, remark, vendorId} = body;
            const vendor =  await prisma.Product.create({
                data: {
                    name,
                    remark,
                    vendorId
                }
            })
            return JSON.stringify(new SuccessResponse<string>(vendor, "产品创建成功"));
        }, {
            body: z.object({
                name: z.string().min(2),
                remark: z.string().max(255).optional(),
                vendorId: z.coerce.number()
            }),
            beforeHandle: async({body}) => {
                // 检查品牌是否已存在
                const userExisted = await prisma.Product.findFirst({
                    where: {
                        name: body.name,
                        vendorId: body.vendorId,
                    }
                });
                
                if (userExisted) {
                    // 抛出 zod 异常，使用自定义错误消息
                    throw new ZodError([
                        {
                            code: "custom",
                            path: ["name", 'vendorId'],
                            message: "产品已存在"
                        }
                    ]);
                }
            }
        })
        // PUT /api/posts/:id - 更新文章
        .get("/getProductById/:id", async ({ params, body }) => {
            const vendor = await prisma.Product.findUnique({
                where: {
                    id: params.id
                },
                include: {
                    Vendor: true
                }
            });
            return JSON.stringify(new SuccessResponse<string>(vendor, "供应商查询成功"));
            // return {
            //     message: `文章 ${params.id} 更新成功`,
            //     post: { id: params.id, ...(body as Record<string, any>) }
            // };
        }, {
            params: z.object({
                id: z.coerce.number()
            })
        })
        // DELETE /api/posts/:id - 删除文章
        .delete("/:id", ({ params }) => {
            return {
                message: `文章 ${params.id} 删除成功`
            };
        }).put('/:id', async ({params, body}) => {
            const {name, remark, price, cost} = body;
            const result = await prisma.Product.update({
                where: {
                    id: params.id
                },
                data: {
                    name,
                    remark,
                    price,
                    cost
                }
            })
            return JSON.stringify(new SuccessResponse<string>(result, "供应商更新成功"));
        }, {
            params: z.object({
                id: z.coerce.number(),
            }),
            body: z.object({
                name: z.string(),
                remark: z.string(),
                price: z.number(),
                cost: z.number(),
            })
        })
});

