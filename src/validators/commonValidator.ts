import {z} from 'zod'

export const updateIdSchema = z.object({
  id: z.coerce.number(),
});

export type UpdateId = z.infer<typeof updateIdSchema>;