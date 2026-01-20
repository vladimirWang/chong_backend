import { z } from "zod";

// 获取文章列表 Query Schema
export const postQuerySchema = z.object({
  cookie: z.string(),
});

export type PostQuery = z.infer<typeof postQuerySchema>;

// 文章参数 Schema
export const postParamsSchema = z.object({
  id: z.coerce.number(),
});

export type PostParams = z.infer<typeof postParamsSchema>;
