import { z } from "zod";
import { paginationSchema } from "./commonValidator";

export const createClientBodySchema = z.object({
  name: z.string().min(2),
  tel: z
    .string()
    .regex(/^1[3-9]\d{9}$/)
    .optional(),
  address: z.string().optional(),
  remark: z.string().optional(),
});

export const patchClientBodySchema = createClientBodySchema.partial({
  name: true,
});

export type CreateClientBody = z.infer<typeof createClientBodySchema>;
export type PatchClientBody = z.infer<typeof patchClientBodySchema>;

export const clientQuerySchema = paginationSchema.extend({
  name: z.string().optional(),
  tel: z.string().optional(),
  address: z.string().optional(),
});

export type ClientQuery = z.infer<typeof clientQuerySchema>;