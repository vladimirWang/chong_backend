import { z, ZodError } from "zod";
import prisma from "../utils/prisma";

export const approveApplicationBodySchema = z
  .object({
    id: z.number(),
  })
  .transform(async (data) => {
    console.log("approveApplicationBodySchema---", data);
    const applicant = await prisma.applicant.findUnique({
      where: { id: data.id },
    });
    if (!applicant) {
      throw new ZodError([
        { code: "custom", path: ["id"], message: "申请人不存在" },
      ]);
    }
    return { ...data, applicant };
  });
export type ApproveApplicationBody = z.infer<
  typeof approveApplicationBodySchema
>;
