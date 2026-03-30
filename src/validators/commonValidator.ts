import { z, ZodError } from "zod";
import prisma from "../utils/prisma";

export const updateIdSchema = z.object({
  id: z.coerce.number(),
});

export type UpdateId = z.infer<typeof updateIdSchema>;

export const paginationSchema = z.object({
  pagination: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  page: z.coerce.number().optional(),
});

export type Pagination = z.infer<typeof paginationSchema>;

export const completedAtSchema = z
  .object({
    completedAt: z.coerce.date().optional(),
  })
  .optional();

export type CompletedAt = z.infer<typeof completedAtSchema>;

export const deletedStartEndSchema = z
  .object({
    deletedStart: z.coerce.date().optional(),
    deletedEnd: z.coerce.date().optional(),
  })
  .optional()
  .refine(
    (data) => {
      if (!data?.deletedStart || !data?.deletedEnd) {
        return false;
      }
      return data.deletedEnd.getTime() <= data.deletedStart.getTime();
    },
    {
      message: "startDate 和 endDate 相差不能超过一年",
      path: ["endDate"],
    },
  );

export type DeletedStartEnd = z.infer<typeof deletedStartEndSchema>;

export const vendorIdSchema = z.object({
  vendorId: z.coerce.number(),
});
export type VendorId = z.infer<typeof vendorIdSchema>;

export const productNameStringSchema = z.object({
  productName: z.string(),
});

export type ProductNameString = z.infer<typeof productNameStringSchema>;

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
  email: z
    .string()
    .email()
    .refine(
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
});
export type ParamEmailNotExisted = z.infer<typeof paramEmailNotExistedSchema>;

export const paramEmailSchema = z.object({
  email: z.string().email(),
});
export type ParamEmail = z.infer<typeof paramEmailSchema>;

export const idArray = z.object({
  ids: z.array(z.coerce.number()),
  // ids: z.string(),
});

export type IdArray = z.infer<typeof idArray>;
