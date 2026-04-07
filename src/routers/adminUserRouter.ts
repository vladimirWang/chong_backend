import { Elysia, t } from "elysia";
import {
  loginUser,
  registerUser,
  checkFileExistedByHash,
  checkEmailExisted,
  getUserSaltByEmail,
  updatePassword,
  resetPassword,
} from "../controllers/adminUserController";
import {
  registerUserBodySchema,
  loginUserBodySchema,
  uploadFileBodySchema,
  updatePasswordBodySchema,
} from "../validators/userValidator";
import {
  paramAdminEmailExistedTransformSchema,
  // paramEmailNotExistedSchema,
} from "../validators/adminCommonValidator";
import { paramEmailSchema } from "../validators/commonValidator";

// 使用 group 创建用户相关的路由组
export const adminUserRouter = new Elysia({ prefix: "/admin/user" })
  .get("/", () => {
    return {
      users: [
        { id: 1, name: "张三" },
        { id: 2, name: "李四" },
      ],
    };
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
  .get("/checkFileExisted/:hash", checkFileExistedByHash, {
    params: t.Object({
      hash: t.String(),
    }),
  })
  .get("/checkEmailExisted/:email", checkEmailExisted, {
    params: paramEmailSchema,
  })
  .get("/getSalt/:email", getUserSaltByEmail, {
    params: paramAdminEmailExistedTransformSchema, // 复用已有的邮箱参数校验规则
  })
  .post("/updatePassword", updatePassword, {
    body: updatePasswordBodySchema,
  })
  .post("/resetPassword", resetPassword, {
    body: paramAdminEmailExistedTransformSchema,
  });
