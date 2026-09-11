import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  batchDeleteVendorHandler,
  createVendorHandler,
  deleteVendorHandler,
  getVendorByIdHandler,
  getVendorWithProductsHandler,
  getVendorsHandler,
  updateVendorHandler,
} from "./vendorController";
import {
  createVendorBodySchema,
  updateVendorBodySchema,
  vendorBatchDeleteSchema,
  vendorQuerySchema,
} from "./vendorValidator";
import { updateIdSchema } from "../../validators/commonValidator";

/**
 * 供应商路由（整体在 authMiddleware 之后，均需登录；tenantPrisma 已按当前租户隔离）
 * 注意：/batch 必须排在 /:id 之前注册，避免被参数路由吞掉
 */
const vendorRouter = new Hono()
  .get("/", zValidator("query", vendorQuerySchema), getVendorsHandler)
  .post("/", zValidator("json", createVendorBodySchema), createVendorHandler)
  .get(
    "/byId/:id",
    zValidator("param", updateIdSchema),
    getVendorWithProductsHandler,
  )
  .get("/:id", zValidator("param", updateIdSchema), getVendorByIdHandler)
  .delete("/batch", zValidator("json", vendorBatchDeleteSchema), batchDeleteVendorHandler)
  .delete("/:id", zValidator("param", updateIdSchema), deleteVendorHandler)
  .put(
    "/:id",
    zValidator("param", updateIdSchema),
    zValidator("json", updateVendorBodySchema),
    updateVendorHandler,
  );

export { vendorRouter };
