import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getTenantHandler, updateTenantHandler } from "./tenantController";
import { updateTenantBodySchema } from "./tenantValidator";

/**
 * 租户设置路由（挂在 /nodejs_api/tenant 下，均需登录）
 * GET /        查看当前租户信息（仅 superUser）
 * PUT /        更新租户名称 / logo（仅 superUser）
 */
const tenantRouter = new Hono()
  .get("/", getTenantHandler)
  .put("/", zValidator("json", updateTenantBodySchema), updateTenantHandler);

export { tenantRouter };
