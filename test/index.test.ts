import { describe, expect, it, beforeAll } from "bun:test";
import { treaty } from "@elysiajs/eden";

// 加载测试环境变量
import { config } from "dotenv";
config({ path: ".env.development" });

// 在环境变量加载后再导入 app
const { app } = await import("../src/index");

// 创建 Eden 客户端
const client = treaty(app);

describe("根路由测试", () => {
  it("GET / 应该返回 Hello Elysia", async () => {
    const { data, status } = await client.index.get();

    expect(status).toBe(200);
    expect(data).toBe("Hello Elysia");
  });
});
