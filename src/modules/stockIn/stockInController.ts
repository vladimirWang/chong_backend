import type { Context } from "hono";
import {
  batchDeleteStockIn,
  confirmCompleted,
  createMultipleStockIn,
  getStockInById,
  getStockIns,
  restoreDeletedStockIn,
  updateStockIn,
} from "./stockInService";
import type {
  BatchDeleteStockInQuery,
  MultipleStockInBody,
  StockInQuery,
} from "./stockInValidator";
import type { CompletedAt, IdArray, UpdateId } from "../../validators/commonValidator";

/** GET /stockin */
export const getStockInsHandler = async (c: Context) => {
  const query = c.req.valid("query" as never) as StockInQuery;
  return c.json(await getStockIns(c.get("tenantPrisma"), query));
};

/** POST /stockin/multiple */
export const createMultipleStockInHandler = async (c: Context) => {
  const body = c.req.valid("json" as never) as MultipleStockInBody;
  return c.json(
    await createMultipleStockIn(c.get("tenantPrisma"), c.get("user")!, body),
  );
};

/** GET /stockin/:id */
export const getStockInByIdHandler = async (c: Context) => {
  const { id } = c.req.valid("param" as never) as UpdateId;
  return c.json(await getStockInById(c.get("tenantPrisma"), id));
};

/** PUT /stockin/:id */
export const updateStockInHandler = async (c: Context) => {
  const { id } = c.req.valid("param" as never) as UpdateId;
  const body = c.req.valid("json" as never) as MultipleStockInBody;
  return c.json(
    await updateStockIn(c.get("tenantPrisma"), c.get("user")!, id, body),
  );
};

/** PATCH /stockin/confirmCompleted/:id */
export const confirmCompletedHandler = async (c: Context) => {
  const { id } = c.req.valid("param" as never) as UpdateId;
  const { completedAt } = (c.req.valid("json" as never) as CompletedAt) ?? {};
  return c.json(
    await confirmCompleted(
      c.get("tenantPrisma"),
      c.get("user")!,
      id,
      completedAt,
    ),
  );
};

/** DELETE /stockin/batchDelete?id= */
export const batchDeleteStockInHandler = async (c: Context) => {
  const query = c.req.valid("query" as never) as BatchDeleteStockInQuery;
  return c.json(
    await batchDeleteStockIn(c.get("tenantPrisma"), c.get("user")!, query),
  );
};

/** POST /stockin/restoreDeleted */
export const restoreDeletedStockInHandler = async (c: Context) => {
  const { ids } = c.req.valid("json" as never) as IdArray;
  return c.json(
    await restoreDeletedStockIn(c.get("tenantPrisma"), c.get("user")!, ids),
  );
};
