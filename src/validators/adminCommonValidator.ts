import { z, ZodError } from "zod";
import prisma from "../utils/prisma";

/** 邮箱已存在校验：一次查询，解析结果含 user，供 handler 复用 */
export const paramAdminEmailExistedTransformSchema = z
  .object({
    email: z.email(),
  })
  .transform(async (data) => {
    const user = await prisma.adminUser.findFirst({
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
export type ParamAdminEmailExistedTransform = z.infer<
  typeof paramAdminEmailExistedTransformSchema
>;
