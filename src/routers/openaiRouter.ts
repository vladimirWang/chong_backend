import { Elysia } from "elysia";
import { deepseekChatStream } from "../controllers/deepseekController";
import { openaiChatSchema } from "../validators/openaiValidator";

export const openaiRouter = new Elysia({ prefix: "/openai" })
  .post("/deepseek/chat/stream", deepseekChatStream, {
    body: openaiChatSchema,
  });
