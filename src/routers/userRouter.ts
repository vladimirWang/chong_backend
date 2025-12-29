import { Elysia, t } from "elysia";
import prisma from "../utils/prisma";
import { jwt } from '@elysiajs/jwt'

// 使用 group 创建用户相关的路由组
export const userRouter = new Elysia()
    .use(
        jwt({
            name: 'jwt',
            secret: 'Fischl von Luftschloss Narfidort'
        })
    )
    .group("/api/users", (app) => {
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
        .guard({
            query: t.Object({
                name: t.String()
            })
        })
        .get('/query', ({ query }) => query.name)
        // GET /api/users/:id - 获取单个用户
        .get("/:id", ({ params }) => {
            return {
                id: params.id,
                name: `用户 ${params.id}`
            };
        })
        .guard({
            body: t.Object({
                email: t.String(),
                password: t.String()
            })
        })
        // POST /api/users - 创建用户
        .post("/register", async ({ body }) => {
            // const user = await prisma.user.create({
            //     data: {
            //         email: body.email,
            //         password: body.password
            //     }
            // });

            return {
                message: "用户创建成功",
                user: 'user'
            };
        })
        .post("/login", async ({ body, jwt }) => {
            // 生成 token
            const token = await jwt.sign({
                userId: 1,
                username: "john",
            });

            return {
                success: true,
                message: "用户登录成功",
                token: token
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