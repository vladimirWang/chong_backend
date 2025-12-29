import { Elysia } from "elysia";
import prisma from "../utils/prisma";

// 使用 group 创建用户相关的路由组
export const userRouter = new Elysia().group("/api/users", (app) => {
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
        // POST /api/users - 创建用户
        .post("/register", async ({ body }) => {
            const user = await prisma.user.create({
                data: {
                    email: "123@qq.com",
                    name: 'john'
                }
            });

            return {
                message: "用户创建成功",
                user: user
            };
        })
        .post("/login", async ({ body }) => {
            return {
                message: "用户登录成功",
                user: body
            };
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