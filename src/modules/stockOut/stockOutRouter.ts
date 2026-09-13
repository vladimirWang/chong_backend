import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  batchDeleteStockOutHandler,
  confirmStockOutCompletedHandler,
  createMultipleStockOutHandler,
  getStockOutDetailByIdHandler,
  getStockOutsHandler,
  restoreDeletedStockOutHandler,
  updateStockOutHandler,
} from "./stockOutController";
import {
  createMultipleStockOutSchema,
  multipleStockOutBodySchema,
  stockOutQuerySchema,
} from "./stockOutValidator";
import { batchDeleteStockInQuerySchema } from "../stockIn/stockInValidator";
import {
  completedAtSchema,
  idArray,
  updateIdSchema,
} from "../../validators/commonValidator";

/**
 * 出货路由（均需登录，tenantPrisma 自动租户隔离）
 * 静态具名路由在 /:id 参数路由之前注册
 */
const stockOutRouter = new Hono()
  .get("/", zValidator("query", stockOutQuerySchema), getStockOutsHandler)
  .post(
    "/multiple",
    zValidator("json", createMultipleStockOutSchema),
    createMultipleStockOutHandler,
  )
  .delete(
    "/batchDelete",
    zValidator("query", batchDeleteStockInQuerySchema),
    batchDeleteStockOutHandler,
  )
  .post(
    "/restoreDeleted",
    zValidator("json", idArray),
    restoreDeletedStockOutHandler,
  )
  .patch(
    "/confirmCompleted/:id",
    zValidator("param", updateIdSchema),
    zValidator("json", completedAtSchema),
    confirmStockOutCompletedHandler,
  )
  .get("/:id", zValidator("param", updateIdSchema), getStockOutDetailByIdHandler)
  .put(
    "/:id",
    zValidator("param", updateIdSchema),
    zValidator("json", multipleStockOutBodySchema),
    updateStockOutHandler,
  );

export { stockOutRouter };
