import type { Context } from "hono";
import {
  createSku,
  createSkuCategory,
  getSkus,
  getSkuCategories,
} from "./skuService";
import type {
  CreateSkuBody,
  CreateSkuCategoryBody,
  SkuListQuery,
} from "./skuValidator";

/** GET /sku/category */
export const getSkuCategoriesHandler = async (c: Context) => {
  return c.json(await getSkuCategories(c.get("tenantPrisma")));
};

/** POST /sku/category */
export const createSkuCategoryHandler = async (c: Context) => {
  const body: CreateSkuCategoryBody = await c.req.json();
  return c.json(
    await createSkuCategory(c.get("tenantPrisma"), c.get("user")!, body),
  );
};

/** GET /sku */
export const getSkusHandler = async (c: Context) => {
  const query = c.req.valid("query" as never) as SkuListQuery;
  return c.json(await getSkus(c.get("tenantPrisma"), query));
};

/** POST /sku */
export const createSkuHandler = async (c: Context) => {
  const body: CreateSkuBody = await c.req.json();
  return c.json(await createSku(c.get("tenantPrisma"), c.get("user")!, body));
};
