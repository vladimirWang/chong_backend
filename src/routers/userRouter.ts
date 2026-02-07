import { Elysia, t, status } from "elysia";
import prisma from "../utils/prisma";
import { jwt } from "@elysiajs/jwt";
import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import { z } from "zod";
import { ZodError } from "zod";
const { JWT_SECRET } = process.env;
import {
  loginUser,
  registerUser,
  generateCaptcha,
} from "../controllers/userController";
import {
  registerUserBodySchema,
  loginUserBodySchema,
} from "../validators/userValidator";

// 使用 group 创建用户相关的路由组
export const userRouter = new Elysia({ prefix: "/user" })
  .get("/", () => {
    return {
      users: [
        { id: 1, name: "张三" },
        { id: 2, name: "李四" },
      ],
    };
  })
  // POST /nodejs_api/users/register - 注册用户（需要 email 和 password）
  .post("/register", registerUser, {
    body: registerUserBodySchema,
    beforeHandle: async ({ body }) => {
      // 检查邮箱是否已存在
      const userExisted = await prisma.user.findFirst({
        where: {
          email: body.email,
          // password: body.password
        },
      });

      if (userExisted) {
        // 抛出 zod 异常，使用自定义错误消息
        throw new ZodError([
          {
            code: "custom",
            path: ["email"],
            message: "邮箱已存在",
          },
        ]);
      }
    },
  })
  .get("/current", async ({ jwt, status, user }) => {
    console.log("current user: ", user);
    // return '123'
    return user;
  })
  .post("/login", loginUser, {
    body: loginUserBodySchema,
  })
  // PUT /nodejs_api/users/:id - 更新用户
  .put("/:id", async ({ params, body }) => {
    return {
      message: `用户 ${params.id} 更新成功`,
      user: { id: params.id, ...(body as Record<string, any>) },
    };
  })
  // DELETE /nodejs_api/users/:id - 删除用户
  .delete("/:id", ({ params }) => {
    return {
      message: `用户 ${params.id} 删除成功`,
    };
  })
  .get("/captcha", generateCaptcha);
