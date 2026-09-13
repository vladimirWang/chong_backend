import type { Context } from "hono";
import {
  batchDeleteStockOut,
  confirmStockOutCompleted,
  createMultipleStockOut,
  getStockOutDetailById,
  getStockOuts,
  restoreDeletedStockOut,
  updateStockOut,
} from "./stockOutService";
import type {
  CreateMultipleStockOut,
  MultipleStockOutBody,
  StockOutQuery,
} from "./stockOutValidator";
import type { BatchDeleteStockInQuery } from "../stockIn/stockInValidator";
import type { CompletedAt, IdArray, UpdateId } from "../../validators/commonValidator";

/** GET /stockout */
export const getStockOutsHandler = async (c: Context) => {
  const query = c.req.valid("query" as never) as StockOutQuery;
  return c.json(await getStockOuts(c.get("tenantPrisma"), query));
};

/** POST /stockout/multiple */
export const createMultipleStockOutHandler = async (c: Context) => {
  const body = c.req.valid("json" as never) as CreateMultipleStockOut;
  return c.json(
    await createMultipleStockOut(c.get("tenantPrisma"), c.get("user")!, body),
  );
};

/** PUT /stockout/:id */
export const updateStockOutHandler = async (c: Context) => {
  const { id } = c.req.valid("param" as never) as UpdateId;
  const body = c.req.valid("json" as never) as MultipleStockOutBody;
  return c.json(
    await updateStockOut(c.get("tenantPrisma"), c.get("user")!, id, body),
  );
};

/** PATCH /stockout/confirmCompleted/:id */
export const confirmStockOutCompletedHandler = async (c: Context) => {
  const { id } = c.req.valid("param" as never) as UpdateId;
  const { completedAt } = (c.req.valid("json" as never) as CompletedAt) ?? {};
  return c.json(
    await confirmStockOutCompleted(
      c.get("tenantPrisma"),
      c.get("user")!,
      id,
      completedAt,
    ),
  );
};

/** GET /stockout/:id */
export const getStockOutDetailByIdHandler = async (c: Context) => {
  const { id } = c.req.valid("param" as never) as UpdateId;
  return c.json(await getStockOutDetailById(c.get("tenantPrisma"), id));
};

/** DELETE /stockout/batchDelete?id= */
export const batchDeleteStockOutHandler = async (c: Context) => {
  const query = c.req.valid("query" as never) as BatchDeleteStockInQuery;
  return c.json(
    await batchDeleteStockOut(c.get("tenantPrisma"), c.get("user")!, query),
  );
};

/** POST /stockout/restoreDeleted */
export const restoreDeletedStockOutHandler = async (c: Context) => {
  const { ids } = c.req.valid("json" as never) as IdArray;
  return c.json(
    await restoreDeletedStockOut(c.get("tenantPrisma"), c.get("user")!, ids),
  );
};
