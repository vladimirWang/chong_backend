import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  checkProductNameExistedInVendorHandler,
  createProductHandler,
  deleteProductHandler,
  getLatestSalePriceByProductIdHandler,
  getProductByIdHandler,
  getProductsByAmountHandler,
  getProductsByVendorIdHandler,
  getProductsHandler,
  updateProductHandler,
} from "./productController";
import {
  createProductBodySchema,
  productAmountQuerySchema,
  productQuerySchema,
  updateProductBodySchema,
} from "./productValidator";
import {
  productNameStringSchema,
  updateIdSchema,
  vendorIdSchema,
} from "../../validators/commonValidator";

/**
 * 产品路由（均需登录，tenantPrisma 自动租户隔离）
 * 静态具名路由（getProductsBy...）须在 /:id 参数路由之前注册
 */
const productRouter = new Hono()
  .get("/", zValidator("query", productQuerySchema), getProductsHandler)
  .post("/", zValidator("json", createProductBodySchema), createProductHandler)
  .get(
    "/getProductsByVendorId/:vendorId",
    zValidator("param", vendorIdSchema),
    getProductsByVendorIdHandler,
  )
  .get(
    "/getLatestSalePriceByProductId/:id",
    zValidator("param", updateIdSchema),
    getLatestSalePriceByProductIdHandler,
  )
  .get(
    "/checkProductNameExistedInVendor/:vendorId",
    zValidator("param", vendorIdSchema),
    zValidator("query", productNameStringSchema),
    checkProductNameExistedInVendorHandler,
  )
  .get(
    "/getProductsByAmount",
    zValidator("query", productAmountQuerySchema),
    getProductsByAmountHandler,
  )
  .get("/:id", zValidator("param", updateIdSchema), getProductByIdHandler)
  .patch(
    "/:id",
    zValidator("param", updateIdSchema),
    zValidator("json", updateProductBodySchema),
    updateProductHandler,
  )
  .delete("/:id", zValidator("param", updateIdSchema), deleteProductHandler);

export { productRouter };
