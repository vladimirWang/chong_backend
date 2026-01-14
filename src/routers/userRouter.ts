import { Elysia, t, status } from "elysia";
import prisma from "../utils/prisma";
import { jwt } from '@elysiajs/jwt'
import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import { z } from "zod";
import { ZodError } from "zod";
const { JWT_SECRET } = process.env;

// 使用 group 创建用户相关的路由组
export const userRouter = new Elysia()
    .use(
        jwt({
            name: 'jwt',
            secret: JWT_SECRET!
        })
    )
    .group("/api/user", (app) => {
    return app
        // GET /api/users - 获取用户列表
        .get("/", () => {
            return {
                users: [
                    { id: 1, name: "张三" },
                    { id: 2, name: "李四" }
                ]
            };
        })
        // GET /api/users/:id - 获取单个用户
        .get("/:id", ({ params }) => {
            return {
                id: params.id,
                name: `用户 ${params.id}`
            };
        })
        // POST /api/users/register - 注册用户（需要 email 和 password）
        .post("/register", async ({ body }) => {
            const user = await prisma.user.create({
                data: {
                    email: body.email,
                    password: body.password
                }
            });

            const result = new SuccessResponse(user, "用户创建成功");
            return JSON.stringify(result);
        }, {
            body: z.object({
                email: z.string().email(),
                password: z.string().min(6)
            }),
            beforeHandle: async ({ body }) => {
                // 检查邮箱是否已存在
                const userExisted = await prisma.user.findFirst({
                    where: {
                        email: body.email,
                        password: body.password
                    }
                });
                
                if (userExisted) {
                    // 抛出 zod 异常，使用自定义错误消息
                    throw new ZodError([
                        {
                            code: "custom",
                            path: ["email"],
                            message: "邮箱已存在"
                        }
                    ]);
                }
            }
            // body: t.Object({
            //     email: t.String({
            //         description: "邮箱地址",
            //         format: "email",
            //         minLength: 1
            //     }),
            //     password: t.String({
            //         description: "密码",
            //         minLength: 6
            //     })
            // })
        })
        .post("/login", async ({ body, jwt }) => {
            const userExisted = await prisma.user.findFirst({
                where: {
                    email: body.email,
                    password: body.password
                }
            })
            if (!userExisted) {
                const result = new ErrorResponse(errorCode.USER_NOT_FOUND, "用户不存在");
                return JSON.stringify(result);
            }
            // 生成 token
            const token = await jwt.sign({
                userId: userExisted.id,
                username: userExisted.username,
            });

            return JSON.stringify(new SuccessResponse<string>(token, "用户登录成功"));
        }, {
            body: z.object({
                email: z.string().email(),
                password: z.string().min(6)
            })
        })
        // PUT /api/users/:id - 更新用户
        .put("/:id", async ({ params, body }) => {
            return {
                message: `用户 ${params.id} 更新成功`,
                user: { id: params.id, ...(body as Record<string, any>) }
            };
        })
        // DELETE /api/users/:id - 删除用户
        .delete("/:id", ({ params }) => {
            return {
                message: `用户 ${params.id} 删除成功`
            };
        });
});