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
  checkEmailNotExisted,
} from "../controllers/userController";
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
    body: registerUserBodySchema.extend(paramEmailNotExistedSchema.shape),
  })
  .get("/current", getCurrentUser)
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
  .get("/checkEmailExisted/:email", checkEmailExisted, {
    params: paramEmailExistedSchema,
  })
  .get("/checkEmailNotExisted/:email", checkEmailNotExisted, {
    params: paramEmailSchema,
  })
  .get("/getSalt/:email", getUserSaltByEmail, {
    params: paramEmailExistedSchema, // 复用已有的邮箱参数校验规则
  })
  .post("/updatePassword", updatePassword, {
    body: updatePasswordBodySchema,
  })
  .post("/resetPassword", resetPassword, {
    body: paramEmailExistedSchema,
  });
