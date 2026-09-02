import { z, ZodError } from "zod";
import prisma from "../utils/prisma";

/** 邮箱已存在校验：一次查询，解析结果含 user，供 handler 复用 */
export const paramEmailExistedSchema = z
  .object({
    email: z.string().email(),
  })
  .transform(async (data) => {
    const user = await prisma.user.findFirst({
      where: { email: data.email },
      select: { id: true, email: true, salt: true },
    });
    if (!user) {
      throw new ZodError([
        { code: "custom", path: ["email"], message: "邮箱未注册" },
      ]);
    }
    return { email: data.email, user };
  });
export type ParamEmailExisted = z.infer<typeof paramEmailExistedSchema>;

export const paramEmailNotExistedSchema = z.object({
  email: z.email().refine(
    async (email) => {
      const existed = await prisma.user.findFirst({
        where: {
          email,
        },
      });
      console.log("paramEmailNotExistedSchema refine result: ", existed);
      return !existed;
    },
    { message: "邮箱已注册" },
  ),
  // 创建型场景的新租户名称；为空表示不创建租户
  tenantName: z.string().optional(),
});
export type ParamEmailNotExisted = z.infer<typeof paramEmailNotExistedSchema>;
