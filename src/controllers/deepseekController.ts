import OpenAI from "openai";
import type { OpenAIChatBody } from "../validators/openaiValidator";
import deepSeekClient from "../utils/deepseek";

const sseHeaders = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

function sseErrorResponse(message: string, status = 500) {
  return new Response(
    `event: error\ndata: ${JSON.stringify({ message })}\n\n`,
    {
      status,
      headers: { ...sseHeaders },
    },
  );
}

/**
 * DeepSeek（OpenAI 兼容接口）
 * @see https://api-docs.deepseek.com/
 * 需配置 DEEPSEEK_API_KEY；可选 DEEPSEEK_BASE_URL（默认 https://api.deepseek.com）
 */
export const deepseekChatStream = async ({
  body,
}: {
  body: OpenAIChatBody;
}) => {
  const model = body.model ?? process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const temperature = body.temperature ?? 0;
  const max_tokens = body.maxTokens ?? 128;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: string) =>
        controller.enqueue(encoder.encode(payload));
      send(`:ok\n\n`);
      const keepAlive = setInterval(() => send(`:ping\n\n`), 15000);

      try {
        send(`event: meta\ndata: ${JSON.stringify({ model })}\n\n`);

        const completion = await deepSeekClient.chat.completions.create({
          model,
          temperature,
          max_tokens,
          stream: true,
          messages: [{ role: "user", content: body.prompt }],
        });

        for await (const chunk of completion) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            send(`data: ${JSON.stringify({ delta })}\n\n`);
          }
        }

        send(`event: done\ndata: {}\n\n`);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "DeepSeek 请求失败";
        send(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
      } finally {
        clearInterval(keepAlive);
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { ...sseHeaders } });
};
