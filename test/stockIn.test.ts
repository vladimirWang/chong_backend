import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { app } from "../src/index";
import prisma from "../src/utils/prisma";

// 创建 Eden 客户端
const client = treaty(app);

describe("进货功能测试", () => {
  let token: string;

  beforeAll(async () => {
    // 1. 从 User 表查找第一个用户
    const firstUser = await prisma.user.findFirst();

    if (!firstUser) {
      throw new Error(
        "User 表中没有用户，请先运行 import-data.sh 导入测试数据",
      );
    }

    console.log(`使用用户登录: ${firstUser.email}`);

    // 2. 用该用户的 email 和 password 登录
    const loginResponse = await client.api.user.login.post({
      email: firstUser.email,
      password: firstUser.password,
    });

    expect(loginResponse.status).toBe(200);

    const loginData = loginResponse.data as {
      code: number;
      data: string;
      message: string;
    };
    expect(loginData.code).toBe(200);

    token = loginData.data;
    console.log(`登录成功，获取 Token: ${token.substring(0, 30)}...`);
  });

  it("新增进货后，Product 的 balance 应该正确更新", async () => {
    // 3. 新增一笔进货数据
    const stockInData = {
      remark: "importRemark",
      productJoinStockIn: [
        {
          cost: 100,
          count: 200,
          productId: 1,
        },
        {
          cost: 10,
          count: 20,
          productId: 2,
        },
      ],
    };

    // 调用批量进货接口
    const stockInResponse = await client.api.stockin.multiple.post(
      stockInData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    console.log("进货响应:", stockInResponse.data);

    expect(stockInResponse.status).toBe(200);

    const responseData = stockInResponse.data as {
      code: number;
      message: string;
    };
    expect(responseData.code).toBe(200);

    // 4. 用原始 SQL 直接查询 Product 表的 balance
    const [product1] = await prisma.$queryRaw<
      { id: number; name: string; balance: number }[]
    >`SELECT id, name, balance FROM Product WHERE id = 1`;

    const [product2] = await prisma.$queryRaw<
      { id: number; name: string; balance: number }[]
    >`SELECT id, name, balance FROM Product WHERE id = 2`;

    console.log(
      `Product 1 (${product1?.name}): balance = ${product1?.balance}`,
    );
    console.log(
      `Product 2 (${product2?.name}): balance = ${product2?.balance}`,
    );

    // 验证 balance 是否正确
    expect(product1?.balance).toBe(200);
    expect(product2?.balance).toBe(20);

    console.log("✅ 进货后 balance 验证通过！");
  });

  afterAll(async () => {
    // 清理测试数据（可选）
    await prisma.$disconnect();
  });
});
