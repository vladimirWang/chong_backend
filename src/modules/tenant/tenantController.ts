import type { Context } from "hono";
import { getTenantProfile, updateTenantProfile } from "./tenantService";
import type { UpdateTenantBody } from "./tenantValidator";

/** GET /tenant：当前租户信息（仅 superUser） */
export const getTenantHandler = async (c: Context) => {
  return c.json(await getTenantProfile(c.get("user")));
};

/** PUT /tenant：更新租户名称 / logo（仅 superUser） */
export const updateTenantHandler = async (c: Context) => {
  const body = c.req.valid("json" as never) as UpdateTenantBody;
  return c.json(await updateTenantProfile(c.get("user"), body));
};
