import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createSkuCategoryHandler,
  createSkuHandler,
  getSkusHandler,
  getSkuCategoriesHandler,
} from "./skuController";
import {
  createSkuBodySchema,
  createSkuCategoryBodySchema,
  skuListQuerySchema,
} from "./skuValidator";

/**
 * SKU 路由（均需登录，tenantPrisma 自动租户隔离）
 * 静态具名路由 /category 须在参数路由之前注册
 */
const skuRouter = new Hono()
  .get("/", zValidator("query", skuListQuerySchema), getSkusHandler)
  .post("/", zValidator("json", createSkuBodySchema), createSkuHandler)
  .get("/category", getSkuCategoriesHandler)
  .post(
    "/category",
    zValidator("json", createSkuCategoryBodySchema),
    createSkuCategoryHandler,
  );

export { skuRouter };
