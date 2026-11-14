import type { Context } from "hono";
import {
  cancelAfterSales,
  confirmCustomerReceipt,
  confirmMerchantReceipt,
  createAfterSales,
  getAfterSales,
  getAfterSalesById,
  getStockOutAvailableLines,
  getStockOutOptions,
} from "./afterSalesService";
import type {
  AfterSalesQuery,
  ConfirmCustomerBody,
  ConfirmMerchantBody,
  CreateAfterSalesBody,
  StockOutIdParam,
  StockOutOptionsQuery,
} from "./afterSalesValidator";
import type { AuthUser } from "../../types/auth";
import type { UpdateId } from "../../validators/commonValidator";

/** GET /afterSales */
export const getAfterSalesHandler = async (c: Context) => {
  const query = c.req.valid("query" as never) as AfterSalesQuery;
  return c.json(await getAfterSales(c.get("tenantPrisma"), query));
};

/** POST /afterSales */
export const createAfterSalesHandler = async (c: Context) => {
  const body = c.req.valid("json" as never) as CreateAfterSalesBody;
  const user = c.get("user") as AuthUser;
  return c.json(await createAfterSales(c.get("tenantPrisma"), user, body));
};

/** GET /afterSales/:id */
export const getAfterSalesByIdHandler = async (c: Context) => {
  const { id } = c.req.valid("param" as never) as UpdateId;
  return c.json(await getAfterSalesById(c.get("tenantPrisma"), id));
};

/** PATCH /afterSales/:id/confirmMerchant */
export const confirmMerchantReceiptHandler = async (c: Context) => {
  const { id } = c.req.valid("param" as never) as UpdateId;
  const body = (c.req.valid("json" as never) as ConfirmMerchantBody) ?? {};
  const user = c.get("user") as AuthUser;
  return c.json(
    await confirmMerchantReceipt(c.get("tenantPrisma"), user, id, body),
  );
};

/** PATCH /afterSales/:id/confirmCustomer */
export const confirmCustomerReceiptHandler = async (c: Context) => {
  const { id } = c.req.valid("param" as never) as UpdateId;
  const body = (c.req.valid("json" as never) as ConfirmCustomerBody) ?? {};
  const user = c.get("user") as AuthUser;
  return c.json(
    await confirmCustomerReceipt(c.get("tenantPrisma"), user, id, body),
  );
};

/** PATCH /afterSales/:id/cancel */
export const cancelAfterSalesHandler = async (c: Context) => {
  const { id } = c.req.valid("param" as never) as UpdateId;
  const user = c.get("user") as AuthUser;
  return c.json(await cancelAfterSales(c.get("tenantPrisma"), user, id));
};

/** GET /afterSales/stockOutOptions */
export const getStockOutOptionsHandler = async (c: Context) => {
  const query = c.req.valid("query" as never) as StockOutOptionsQuery;
  return c.json(await getStockOutOptions(c.get("tenantPrisma"), query));
};

/** GET /afterSales/stockOut/:stockOutId/available */
export const getStockOutAvailableLinesHandler = async (c: Context) => {
  const { stockOutId } = c.req.valid("param" as never) as StockOutIdParam;
  const user = c.get("user") as AuthUser;
  return c.json(
    await getStockOutAvailableLines(
      c.get("tenantPrisma"),
      user.tenantId!,
      stockOutId,
    ),
  );
};
