import type { Context } from "hono";
import type { AuthUser } from "../../types/auth";
import {
  cancelInventoryCheck,
  completeInventoryCheck,
  createInventoryCheck,
  getInventoryCheckById,
  getInventoryChecks,
  startInventoryCheck,
  updateInventoryCheckItems,
} from "./inventoryCheckService";
import type {
  CreateInventoryCheckBody,
  InventoryCheckItemsBody,
  InventoryCheckQuery,
} from "./inventoryCheckValidator";
import type { UpdateId } from "../../validators/commonValidator";

export const createInventoryCheckHandler = async (c: Context) => {
  const body = c.req.valid("json" as never) as CreateInventoryCheckBody;
  const user = c.get("user") as AuthUser;
  return c.json(await createInventoryCheck(c.get("tenantPrisma"), user, body));
};

export const getInventoryChecksHandler = async (c: Context) => {
  const query = c.req.valid("query" as never) as InventoryCheckQuery;
  return c.json(await getInventoryChecks(c.get("tenantPrisma"), query));
};

export const getInventoryCheckByIdHandler = async (c: Context) => {
  const { id } = c.req.valid("param" as never) as UpdateId;
  return c.json(await getInventoryCheckById(c.get("tenantPrisma"), id));
};

export const startInventoryCheckHandler = async (c: Context) => {
  const { id } = c.req.valid("param" as never) as UpdateId;
  const user = c.get("user") as AuthUser;
  return c.json(await startInventoryCheck(c.get("tenantPrisma"), user, id));
};

export const updateInventoryCheckItemsHandler = async (c: Context) => {
  const { id } = c.req.valid("param" as never) as UpdateId;
  const body = c.req.valid("json" as never) as InventoryCheckItemsBody;
  const user = c.get("user") as AuthUser;
  return c.json(await updateInventoryCheckItems(c.get("tenantPrisma"), user, id, body));
};

export const completeInventoryCheckHandler = async (c: Context) => {
  const { id } = c.req.valid("param" as never) as UpdateId;
  const user = c.get("user") as AuthUser;
  return c.json(await completeInventoryCheck(c.get("tenantPrisma"), user, id));
};

export const cancelInventoryCheckHandler = async (c: Context) => {
  const { id } = c.req.valid("param" as never) as UpdateId;
  const user = c.get("user") as AuthUser;
  return c.json(await cancelInventoryCheck(c.get("tenantPrisma"), user, id));
};
