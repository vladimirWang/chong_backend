import { z } from "zod";
import { paginationSchema } from "../../validators/commonValidator";

/** POST /client body（移植自老架构：name 至少 2 字符，tel 为大陆手机号） */
export const createClientBodySchema = z.object({
  name: z.string().min(2),
  tel: z
    .string()
    .regex(/^1[3-9]\d{9}$/)
    .optional(),
  address: z.string().optional(),
  remark: z.string().optional(),
});
export type CreateClientBody = z.infer<typeof createClientBodySchema>;

/** PATCH /client/:id body：所有字段均可选（老架构对 name 也做了 partial） */
export const patchClientBodySchema = createClientBodySchema.partial();
export type PatchClientBody = z.infer<typeof patchClientBodySchema>;

/** GET /client 列表 query */
export const clientQuerySchema = paginationSchema.extend({
  name: z.string().optional(),
  tel: z.string().optional(),
  address: z.string().optional(),
});
export type ClientQuery = z.infer<typeof clientQuerySchema>;
