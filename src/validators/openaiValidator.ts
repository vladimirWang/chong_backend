import { z } from "zod";

export const openaiChatSchema = z.object({
  prompt: z.string().min(1, "prompt 不能为空"),
  model: z.string().min(1).optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
  maxTokens: z.coerce.number().int().min(1).max(2048).optional(),
});

export type OpenAIChatBody = z.infer<typeof openaiChatSchema>;

