import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  cancelInventoryCheckHandler,
  completeInventoryCheckHandler,
  createInventoryCheckHandler,
  getInventoryCheckByIdHandler,
  getInventoryChecksHandler,
  startInventoryCheckHandler,
  updateInventoryCheckItemsHandler,
} from "./inventoryCheckController";
import {
  createInventoryCheckBodySchema,
  inventoryCheckItemsBodySchema,
  inventoryCheckQuerySchema,
} from "./inventoryCheckValidator";
import { updateIdSchema } from "../../validators/commonValidator";

/**
 * 盘点路由（均需登录，tenantPrisma 自动租户隔离）
 */
const inventoryCheckRouter = new Hono()
  .post(
    "/",
    zValidator("json", createInventoryCheckBodySchema),
    createInventoryCheckHandler,
  )
  .get(
    "/",
    zValidator("query", inventoryCheckQuerySchema),
    getInventoryChecksHandler,
  )
  .patch(
    "/:id/start",
    zValidator("param", updateIdSchema),
    startInventoryCheckHandler,
  )
  .patch(
    "/:id/complete",
    zValidator("param", updateIdSchema),
    completeInventoryCheckHandler,
  )
  .patch(
    "/:id/cancel",
    zValidator("param", updateIdSchema),
    cancelInventoryCheckHandler,
  )
  .put(
    "/:id/items",
    zValidator("param", updateIdSchema),
    zValidator("json", inventoryCheckItemsBodySchema),
    updateInventoryCheckItemsHandler,
  )
  .get("/:id", zValidator("param", updateIdSchema), getInventoryCheckByIdHandler);

export { inventoryCheckRouter };
