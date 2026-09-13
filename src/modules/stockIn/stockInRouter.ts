import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  batchDeleteStockInHandler,
  confirmCompletedHandler,
  createMultipleStockInHandler,
  getStockInByIdHandler,
  getStockInsHandler,
  restoreDeletedStockInHandler,
  updateStockInHandler,
} from "./stockInController";
import {
  batchDeleteStockInQuerySchema,
  multipleStockInBodySchema,
  stockInQuerySchema,
} from "./stockInValidator";
import {
  completedAtSchema,
  idArray,
  updateIdSchema,
} from "../../validators/commonValidator";

/**
 * 进货路由（均需登录，tenantPrisma 自动租户隔离）
 * 静态具名路由（multiple/batchDelete/...）在 /:id 参数路由之前注册
 */
const stockInRouter = new Hono()
  .get("/", zValidator("query", stockInQuerySchema), getStockInsHandler)
  .post(
    "/multiple",
    zValidator("json", multipleStockInBodySchema),
    createMultipleStockInHandler,
  )
  .delete(
    "/batchDelete",
    zValidator("query", batchDeleteStockInQuerySchema),
    batchDeleteStockInHandler,
  )
  .post(
    "/restoreDeleted",
    zValidator("json", idArray),
    restoreDeletedStockInHandler,
  )
  .patch(
    "/confirmCompleted/:id",
    zValidator("param", updateIdSchema),
    zValidator("json", completedAtSchema),
    confirmCompletedHandler,
  )
  .get("/:id", zValidator("param", updateIdSchema), getStockInByIdHandler)
  .put(
    "/:id",
    zValidator("param", updateIdSchema),
    zValidator("json", multipleStockInBodySchema),
    updateStockInHandler,
  );

export { stockInRouter };
