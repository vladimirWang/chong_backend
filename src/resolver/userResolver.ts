import { ZodError } from "zod";
import { type ParamEmail } from "../validators/commonValidator";
import prisma from "../utils/prisma";

type EmailFromParamsOrBody = {
  params?: Partial<ParamEmail>;
  body?: { email?: string } | { email?: string } & Record<string, unknown>;
};

function throwEmailZodError(message: string) {
  throw new ZodError([
    {
      code: "custom",
      path: ["email"],
      message,
    },
  ]);
}

/**
 * 通用 resolver：
 * - 支持从 `params.email` 或 `body.email` 取邮箱
 * - 查到后注入 `{ user }`
 * - 未传 email 或用户不存在时抛 ZodError（path: ['email']）
 */
export const resolveUserByEmail = async ({ params, body }: EmailFromParamsOrBody) => {
  const email = params?.email ?? body?.email;
  if (!email) {
    throwEmailZodError("缺少邮箱");
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });
  if (!user) {
    throwEmailZodError("邮箱未注册");
  }

  return { user };
};

export const resolveEmailExisted = async ({
  params,
}: {
  params: ParamEmail;
}) => {
  return resolveUserByEmail({ params });
};
