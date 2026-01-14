import { Elysia } from "elysia";
import { jwt } from '@elysiajs/jwt'
import { z } from "zod";

const { JWT_SECRET } = process.env;

// 文章相关路由模块
export const postRouter = new Elysia()
    .use(
        jwt({
            name: 'jwt',
            secret: JWT_SECRET!
        })
    )
    .group("/api/post", (app) => {
    return app
        // GET /api/posts - 获取文章列表
        .get("/", async (
            {query, jwt, status, headers: { authorization }}
        ) => {
        
        const profile = await jwt.verify(authorization)

        if (!profile){
            return status(401, 'Unauthorized: Invalid token')
        }
        console.log("token verified: ", profile)
            return {
                posts: [
                    { id: 1, title: "第一篇文章", content: "内容..." },
                    { id: 2, title: "第二篇文章", content: "内容..." }
                ]
            };
        }, {
            query: z.object({
                cookie: z.string()
            }),
        })
        // GET /api/posts/:id - 获取单个文章
        .get("/:id", ({ params, status, cookie: {auth} }) => {
            return {
                id: params.id,
                title: `1文章 ${params.id}`,
                content: "文章内容..."
            };
        })
        // POST /api/posts - 创建文章
        .post("/", async ({ body }) => {
            return {
                message: "文章创建成功",
                post: { id: Date.now(), ...(body as Record<string, any>) }
            };
        })
        // PUT /api/posts/:id - 更新文章
        .put("/:id", async ({ params, body }) => {
            return {
                message: `文章 ${params.id} 更新成功`,
                post: { id: params.id, ...(body as Record<string, any>) }
            };
        })
        // DELETE /api/posts/:id - 删除文章
        .delete("/:id", ({ params }) => {
            return {
                message: `文章 ${params.id} 删除成功`
            };
        });
});

