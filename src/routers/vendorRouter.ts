import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { z, ZodError } from "zod";
import prisma from "../utils/prisma";
import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import { getPaginationValues, getWhereValues } from "../utils/db";
import {
  getVendors,
  deleteVendor,
  batchDeleteVendor,
} from "../controllers/vendorController";
import {
  vendorQuerySchema,
  VendorBatchDelete,
  vendorBatchDeleteSchema,
} from "../validators/vendorValidator";
import { updateIdSchema } from "../validators/commonValidator";

const { JWT_SECRET } = process.env;

// 供应商相关路由模块
export const vendorRouter = new Elysia({ prefix: "/vendor" })
  .get("/", getVendors, {
    query: vendorQuerySchema,
  })
  // GET /api/posts/:id - 获取单个文章
  .get(
    "/:id",
    async ({ params, status, cookie: { auth } }) => {
      const vendor = await prisma.vendor.findUnique({
        where: {
          id: params.id,
        },
      });
      if (!vendor) {
        const result = new ErrorResponse(10006, "没有查到供应商信息");
        return status(404, JSON.stringify(result));
      }
      return new SuccessResponse(vendor, "供应商获取成功");
    },
    {
      params: updateIdSchema,
    },
  )
  // POST /api/posts - 创建供应商
  .post(
    "/",
    async ({ body }) => {
      const { name, remark } = body;
      const vendor = await prisma.vendor.create({
        data: {
          name,
          remark,
        },
      });
      return new SuccessResponse(vendor, "供应商创建成功");
    },
    {
      body: z.object({
        name: z.string().min(2),
        remark: z.string().optional(),
      }),
      beforeHandle: async ({ body }) => {
        // 检查品牌是否已存在
        const userExisted = await prisma.vendor.findFirst({
          where: {
            name: body.name,
            // password: body.password
          },
        });

        if (userExisted) {
          // 抛出 zod 异常，使用自定义错误消息
          throw new ZodError([
            {
              code: "custom",
              path: ["name"],
              message: "品牌名已存在",
            },
          ]);
        }
      },
    },
  )
  // PUT /api/posts/:id - 更新文章
  .get(
    "/byId/:id",
    async ({ params, body }) => {
      const vendor = await prisma.vendor.findUnique({
        where: {
          id: params.id,
        },
        include: {
          products: true,
        },
      });
      return new SuccessResponse<string>(vendor, "供应商获取成功")
      // return {
      //     message: `文章 ${params.id} 更新成功`,
      //     post: { id: params.id, ...(body as Record<string, any>) }
      // };
    },
    {
      params: updateIdSchema,
    },
  )
  // DELETE /api/vendor/:id - 删除供应商
  .delete("/:id", deleteVendor, {
    params: updateIdSchema,
    beforeHandle: async ({ params }) => {
      const vendor = await prisma.vendor.findUnique({
        where: {
          id: params.id,
        },
      });
      if (!vendor) {
        throw new ZodError([
          {
            code: "custom",
            path: ["id"],
            message: "供应商不存在",
          },
        ]);
      }
    },
  })
  .delete("/batch", batchDeleteVendor, {
    body: vendorBatchDeleteSchema,
  })
  .put(
    "/:id",
    async ({ params, body }) => {
      const { name, remark } = body;
      const updatedVendor = await prisma.vendor.update({
        where: {
          id: params.id,
        },
        data: {
          name,
          remark,
        },
      });
      return JSON.stringify(
        new SuccessResponse<string>(updatedVendor, "供应商更新成功"),
      );
    },
    {
      params: updateIdSchema,
      body: z.object({
        name: z.string().min(2).optional(),
        remark: z.string().optional(),
      }),
    },
  );
