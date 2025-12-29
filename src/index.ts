import { Elysia } from "elysia";
// 从 routers/index.ts 统一导入所有路由模块
import { userRouter, postRouter } from "./routers";

// 创建主应用并注册所有路由模块
const app = new Elysia()
    .get("/", () => "Hello Elysia")
    // 使用 .use() 方法整合路由模块
    // 每个路由模块会自动添加其 group 前缀
    .use(userRouter)  // 注册 /api/users/* 路由
    .use(postRouter)  // 注册 /api/posts/* 路由
    .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
