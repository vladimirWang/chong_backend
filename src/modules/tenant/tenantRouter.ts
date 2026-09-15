import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getTenantInfoHandler, getTenantHandler, updateTenantHandler } from "./tenantController";
import { updateTenantBodySchema } from "./tenantValidator";

/**
 * 租户路由（挂在 /nodejs_api/tenant 下，均需登录）
 * GET /info    当前租户基本信息（任意租户用户，用于侧边栏展示）
 * GET /        当前租户完整信息（仅 superUser，租户设置页）
 * PUT /        更新租户名称 / logo（仅 superUser）
 */
const tenantRouter = new Hono()
  .get("/info", getTenantInfoHandler)
  .get("/", getTenantHandler)
  .put("/", zValidator("json", updateTenantBodySchema), updateTenantHandler);

export { tenantRouter };
