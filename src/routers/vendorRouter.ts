import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { z, ZodError } from "zod";
import prisma, { TenantPrismaClient } from "../utils/prisma";
import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import type { AuthContext } from "../controllers/userController";
import { auditCreateConnect, auditUpdate } from "../utils/auditUser";
import { getPaginationValues, getWhereValues } from "../utils/db";
import { authService, AuthInject } from "../macro/auth.macro";
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

// 供应商路由 handler 可用的完整 ctx：认证宏注入的 user/tenantPrisma/tenantId + Elysia Context
type VendorAuthCtx = AuthContext & AuthInject;

// 供应商相关路由模块
export const vendorRouter = new Elysia({ prefix: "/vendor" })
  .use(authService)
  .guard({ isSignIn: true }, (app) =>
    app
      .get("/", getVendors as any, {
        query: vendorQuerySchema,
      })
      // GET /nodejs_api/vendor/:id
      .get(
        "/:id",
        async ({ params, status, tenantPrisma }: VendorAuthCtx) => {
          const vendor = await (tenantPrisma as TenantPrismaClient).vendor.findUnique({
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
      // POST /nodejs_api/vendor - 创建供应商
      .post(
        "/",
        async ({
          body,
          user,
          tenantPrisma,
        }: VendorAuthCtx & { body: { name: string; remark?: string } }) => {
          const uid = user.userId;
          const { name, remark } = body;
          const tenantId = user.tenantId;
          if (!tenantId) {
            return new ErrorResponse(
              errorCode.VALIDATION_ERROR,
              "当前用户未绑定租户",
            );
          }
          const vendor = await (tenantPrisma as TenantPrismaClient).vendor.create({
            data: {
              name,
              remark,
              ...auditCreateConnect(uid),
            },
          });
          return new SuccessResponse(vendor, "供应商创建成功");
        },
        {
          body: z.object({
            name: z.string().min(2),
            remark: z.string().optional(),
          }),
          beforeHandle: async ({ body, user, tenantPrisma }) => {
            const vendorExisted = await (tenantPrisma as TenantPrismaClient).vendor.findFirst({
              where: {
                name: body.name,
              },
            });
            if (vendorExisted) {
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
      // GET /nodejs_api/vendor/byId/:id - 获取供应商及其产品
      .get(
        "/byId/:id",
        async ({ params, tenantPrisma }: VendorAuthCtx) => {
          const vendor = await (tenantPrisma as TenantPrismaClient).vendor.findUnique({
            where: {
              id: params.id,
            },
            include: {
              products: true,
            },
          });
          return new SuccessResponse(vendor, "供应商获取成功");
        },
        {
          params: updateIdSchema,
        },
      )
      // DELETE /nodejs_api/vendor/:id - 删除供应商
      .delete("/:id", deleteVendor as any, {
        params: updateIdSchema,
        beforeHandle: async ({ params, tenantPrisma }) => {
          const vendor = await (tenantPrisma as TenantPrismaClient).vendor.findUnique({
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
      .delete("/batch", batchDeleteVendor as any, {
        body: vendorBatchDeleteSchema,
      })
      .put(
        "/:id",
        async ({ params, body, user, tenantPrisma }: any) => {
          if (!user) {
            return new ErrorResponse(errorCode.VALIDATION_ERROR, "未登录");
          }
          const uid = user.userId;
          const { name, remark } = body;
          const updatedVendor = await (tenantPrisma as TenantPrismaClient).vendor.update({
            where: {
              id: params.id,
            },
            data: {
              name,
              remark,
              ...auditUpdate(uid),
            },
          });
          return JSON.stringify(
            new SuccessResponse(updatedVendor, "供应商更新成功"),
          );
        },
        {
          params: updateIdSchema,
          body: z.object({
            name: z.string().min(2).optional(),
            remark: z.string().optional(),
          }),
        },
      ),
  );
