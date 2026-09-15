import type { Context } from "hono";
import { getTenantInfo, getTenantProfile, updateTenantProfile } from "./tenantService";
import type { UpdateTenantBody } from "./tenantValidator";

/** GET /tenant/info：当前租户基本信息（任意租户用户） */
export const getTenantInfoHandler = async (c: Context) => {
  return c.json(await getTenantInfo(c.get("user")));
};

/** GET /tenant：当前租户完整信息（仅 superUser） */
export const getTenantHandler = async (c: Context) => {
  return c.json(await getTenantProfile(c.get("user")));
};

/** PUT /tenant：更新租户名称 / logo（仅 superUser） */
export const updateTenantHandler = async (c: Context) => {
  const body = c.req.valid("json" as never) as UpdateTenantBody;
  return c.json(await updateTenantProfile(c.get("user"), body));
};
