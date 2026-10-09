import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createAttrCategoryHandler,
  createAttrHandler,
  getAttrsHandler,
  getAttrCategoriesHandler,
} from "./attrController";
import {
  createAttrBodySchema,
  createAttrCategoryBodySchema,
  attrListQuerySchema,
} from "./attrValidator";

/**
 * 属性路由（均需登录，tenantPrisma 自动租户隔离）
 * 静态具名路由 /category 须在参数路由之前注册
 */
const attrRouter = new Hono()
  .get("/", zValidator("query", attrListQuerySchema), getAttrsHandler)
  .post("/", zValidator("json", createAttrBodySchema), createAttrHandler)
  .get("/category", getAttrCategoriesHandler)
  .post(
    "/category",
    zValidator("json", createAttrCategoryBodySchema),
    createAttrCategoryHandler,
  );

export { attrRouter };
