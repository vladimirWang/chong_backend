import { z } from "zod";

/** :id 路径参数（query/path 都是字符串，需要 coerce） */
export const updateIdSchema = z.object({
  id: z.coerce.number(),
});
export type UpdateId = z.infer<typeof updateIdSchema>;

/** 通用分页 query */
export const paginationSchema = z.object({
  pagination: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  page: z.coerce.number().optional(),
});
export type Pagination = z.infer<typeof paginationSchema>;
