import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  cancelAfterSalesHandler,
  confirmCustomerReceiptHandler,
  confirmMerchantReceiptHandler,
  createAfterSalesHandler,
  getAfterSalesByIdHandler,
  getAfterSalesHandler,
  getStockOutAvailableLinesHandler,
  getStockOutOptionsHandler,
} from "./afterSalesController";
import {
  afterSalesQuerySchema,
  confirmCustomerBodySchema,
  confirmMerchantBodySchema,
  createAfterSalesBodySchema,
  stockOutIdParamSchema,
  stockOutOptionsQuerySchema,
} from "./afterSalesValidator";
import { updateIdSchema } from "../../validators/commonValidator";

/**
 * 售后路由（均需登录，tenantPrisma 自动租户隔离）
 * 静态具名路由在 /:id 参数路由之前注册
 */
const afterSalesRouter = new Hono()
  .get("/", zValidator("query", afterSalesQuerySchema), getAfterSalesHandler)
  .post(
    "/",
    zValidator("json", createAfterSalesBodySchema),
    createAfterSalesHandler,
  )
  .get(
    "/stockOutOptions",
    zValidator("query", stockOutOptionsQuerySchema),
    getStockOutOptionsHandler,
  )
  .get(
    "/stockOut/:stockOutId/available",
    zValidator("param", stockOutIdParamSchema),
    getStockOutAvailableLinesHandler,
  )
  .patch(
    "/:id/confirmMerchant",
    zValidator("param", updateIdSchema),
    zValidator("json", confirmMerchantBodySchema),
    confirmMerchantReceiptHandler,
  )
  .patch(
    "/:id/confirmCustomer",
    zValidator("param", updateIdSchema),
    zValidator("json", confirmCustomerBodySchema),
    confirmCustomerReceiptHandler,
  )
  .patch(
    "/:id/cancel",
    zValidator("param", updateIdSchema),
    cancelAfterSalesHandler,
  )
  .get("/:id", zValidator("param", updateIdSchema), getAfterSalesByIdHandler);

export { afterSalesRouter };
