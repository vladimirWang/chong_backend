import { z } from "zod";
import prisma from "../utils/prisma";

/** 邮箱校验：只做格式校验 + 预查询用户，不抛业务错误（业务校验交给 handler） */
export const paramAdminEmailExistedTransformSchema = z
  .object({
    email: z.email(),
  })
  .transform(async (data) => {
    const user = await prisma.adminUser.findFirst({
      where: { email: data.email },
      select: { id: true, email: true, salt: true },
    });
    return { email: data.email, user };
  });
export type ParamAdminEmailExistedTransform = z.infer<
  typeof paramAdminEmailExistedTransformSchema
>;

export const registerAdminUserShortCutBodySchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

export type RegisterAdminUserShortCutBody = z.infer<
  typeof registerAdminUserShortCutBodySchema
>;
