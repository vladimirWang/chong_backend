import {z} from 'zod'

export const updateIdSchema = z.object({
  id: z.coerce.number(),
});

export type UpdateId = z.infer<typeof updateIdSchema>;

export const paginationSchema = z.object({
  pagination: z.coerce.boolean().optional(),
  limit: z.coerce.number().optional(),
  page: z.coerce.number().optional(),
});

export type Pagination = z.infer<typeof paginationSchema>;