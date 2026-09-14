import { z } from "zod";

/** 秒传校验路径参数 */
export const paramHashSchema = z.object({
  hash: z.string(),
});
export type ParamHash = z.infer<typeof paramHashSchema>;
