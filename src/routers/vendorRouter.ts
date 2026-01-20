import { Elysia } from "elysia";
import { jwt } from '@elysiajs/jwt'
import { z, ZodError } from "zod";
import prisma from "../utils/prisma";
import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import {getPaginationValues, getWhereValues} from '../utils/db';

const { JWT_SECRET } = process.env;

// 供应商相关路由模块
export const vendorRouter = new Elysia()
    .group("/api/vendor", (app) => {
    return app
        // GET /api/posts - 获取文章列表
        .get("/", async (
            {query, status, headers: { authorization }}
        ) => {
            const { limit = 10, page = 1, name, pagination = true } = query;
            const {skip, take} = getPaginationValues({limit, page});
            console.log("------cookie: =======================", typeof limit, typeof page, name)

            // 查询条件
            const whereValues = getWhereValues({ name });
            const vendors = await  prisma.vendor.findMany({
                skip: pagination ? skip: undefined,
                take: pagination ? take: undefined,
                where: whereValues
            });
            const total = await prisma.vendor.count({ where: whereValues });
            
            return JSON.stringify(new SuccessResponse({total, list: vendors}, "供应商列表获取成功"));
        }, 
        {
            query: z.object({
                pagination: z.coerce.boolean().optional(),
                limit: z.coerce.number().optional(),
                page: z.coerce.number().optional(),
                name: z.string().optional()
            }),
        }
        )
        // GET /api/posts/:id - 获取单个文章
        .get("/:id", async ({ params, status, cookie: {auth} }) => {
            const vendor = await prisma.vendor.findUnique({
                where: {
                    id: params.id
                }
            });
            return JSON.stringify(new SuccessResponse<string>(vendor, "供应商获取成功"));
        }, {
            params: z.object({
                id: z.coerce.number()
            })
        })
        // POST /api/posts - 创建供应商
        .post("/", async ({ body }) => {
            const {name, remark} = body;
            const vendor =  await prisma.vendor.create({
                data: {
                    name,
                    remark
                }
            })
            return JSON.stringify(new SuccessResponse<string>(vendor, "供应商创建成功"));
        }, {
            body: z.object({
                name: z.string().min(2),
                remark: z.string().optional()
            }),
            beforeHandle: async({body}) => {
                // 检查品牌是否已存在
                const userExisted = await prisma.vendor.findFirst({
                    where: {
                        name: body.name,
                        // password: body.password
                    }
                });
                
                if (userExisted) {
                    // 抛出 zod 异常，使用自定义错误消息
                    throw new ZodError([
                        {
                            code: "custom",
                            path: ["name"],
                            message: "品牌名已存在"
                        }
                    ]);
                }
            }
        })
        // PUT /api/posts/:id - 更新文章
        .get("/byId/:id", async ({ params, body }) => {
            const vendor = await prisma.vendor.findUnique({
                where: {
                    id: params.id
                },
                include: {
                    products: true
                }
            });
            return JSON.stringify(new SuccessResponse<string>(vendor, "供应商获取成功"));
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
        }).put('/:id', async ({ params, body }) => {
            const { name, remark } = body;
            const updatedVendor = await prisma.vendor.update({
                where: {
                    id: params.id
                },
                data: {
                    name,
                    remark
                }
            });
            return JSON.stringify(new SuccessResponse<string>(updatedVendor, "供应商更新成功"));
        }, {
            params: z.object({
                id: z.coerce.number()
            }),
            body: z.object({
                name: z.string().min(2).optional(),
                remark: z.string().optional()
            })
        })
});

