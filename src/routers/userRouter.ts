import { Elysia, t } from "elysia";
import {
  loginUser,
  registerUser,
  logoutUser,
  uploadFile,
  checkFileExistedByHash,
  checkEmailExisted,
  getUserSaltByEmail,
  getCurrentUser,
  updatePassword,
  resetPassword,
  // checkEmailNotExisted,
} from "../controllers/userController";
import {
  startGithubOAuth,
  callbackGithubOAuth,
  exchangeGithubOAuth,
} from "../controllers/githubOAuthController";
import {
  registerUserBodySchema,
  loginUserBodySchema,
  uploadFileBodySchema,
  updatePasswordBodySchema,
} from "../validators/userValidator";
import {
  paramEmailExistedSchema,
  paramEmailNotExistedSchema,
} from "../validators/merchantCommonValidator";
import { paramEmailSchema } from "../validators/commonValidator";
import { authService } from "../macro/auth.macro";

// 使用 group 创建用户相关的路由组
export const userRouter = new Elysia({ prefix: "/user" })
  .use(authService)
  // POST /nodejs_api/users/register - 注册用户（需要 email 和 password）
  .post("/register", registerUser, {
    body: registerUserBodySchema.extend(paramEmailNotExistedSchema.shape),
  })
  .post("/login", loginUser, {
    body: loginUserBodySchema,
  })
  .get("/oauth/github/callback", ({ query, jwt }) => callbackGithubOAuth({ query, jwt }))
  .get("/oauth/github", ({ query }) => startGithubOAuth({ query }))
  .post(
    "/oauth/github/exchange",
    ({ body }) => exchangeGithubOAuth({ body }),
    {
      body: t.Object({
        exchange: t.String({ minLength: 1 }),
      }),
    },
  )
  .get("/checkEmailExisted/:email", checkEmailExisted, {
    params: paramEmailSchema,
  })
  // .get("/checkEmailNotExisted/:email", checkEmailNotExisted, {
  //   params: paramEmailSchema,
  // })
  .get("/getSalt/:email", getUserSaltByEmail, {
    params: paramEmailExistedSchema, // 复用已有的邮箱参数校验规则
  })
  .post("/resetPassword", resetPassword, {
    body: paramEmailExistedSchema,
  });

userRouter.guard({ isSignIn: true }, (app) =>
  app
    .get("/", () => {
      return {
        users: [
          { id: 1, name: "张三" },
          { id: 2, name: "李四" },
        ],
      };
    })
    .get("/current", getCurrentUser)
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
    .post("/logout", logoutUser)
    .post("/upload", uploadFile, {
      type: "multipart/form-data",
      body: uploadFileBodySchema,
    })
    .get("/checkFileExisted/:hash", checkFileExistedByHash, {
      params: t.Object({
        hash: t.String(),
      }),
    })
    .post("/updatePassword", updatePassword, {
      body: updatePasswordBodySchema,
    }),
);
