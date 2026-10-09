import type { Context } from "hono";
import {
  createAttr,
  createAttrCategory,
  getAttrs,
  getAttrCategories,
} from "./attrService";
import type {
  CreateAttrBody,
  CreateAttrCategoryBody,
  AttrListQuery,
} from "./attrValidator";

/** GET /attr/category */
export const getAttrCategoriesHandler = async (c: Context) => {
  return c.json(await getAttrCategories(c.get("tenantPrisma")));
};

/** POST /attr/category */
export const createAttrCategoryHandler = async (c: Context) => {
  const body: CreateAttrCategoryBody = await c.req.json();
  return c.json(
    await createAttrCategory(c.get("tenantPrisma"), c.get("user")!, body),
  );
};

/** GET /attr */
export const getAttrsHandler = async (c: Context) => {
  const query = c.req.valid("query" as never) as AttrListQuery;
  return c.json(await getAttrs(c.get("tenantPrisma"), query));
};

/** POST /attr */
export const createAttrHandler = async (c: Context) => {
  const body: CreateAttrBody = await c.req.json();
  return c.json(await createAttr(c.get("tenantPrisma"), c.get("user")!, body));
};
