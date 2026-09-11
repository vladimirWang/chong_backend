import type { Context } from "hono";
import {
  batchDeleteVendors,
  createVendor,
  deleteVendor,
  getVendorById,
  getVendorWithProducts,
  getVendors,
  updateVendor,
} from "./vendorService";
import type {
  CreateVendorBody,
  UpdateVendorBody,
  VendorBatchDelete,
  VendorQuery,
} from "./vendorValidator";

/** GET /vendor：分页列表 */
export const getVendorsHandler = async (c: Context) => {
  const query = c.req.valid("query" as never) as VendorQuery;
  const result = await getVendors(c.get("tenantPrisma"), query);
  return c.json(result);
};

/** GET /vendor/:id */
export const getVendorByIdHandler = async (c: Context) => {
  const id = Number(c.req.param("id"));
  const result = await getVendorById(c.get("tenantPrisma"), id);
  return c.json(result);
};

/** POST /vendor */
export const createVendorHandler = async (c: Context) => {
  const body: CreateVendorBody = await c.req.json();
  const result = await createVendor(c.get("tenantPrisma"), c.get("user")!, body);
  return c.json(result);
};

/** GET /vendor/byId/:id：供应商及其产品 */
export const getVendorWithProductsHandler = async (c: Context) => {
  const id = Number(c.req.param("id"));
  const result = await getVendorWithProducts(c.get("tenantPrisma"), id);
  return c.json(result);
};

/** DELETE /vendor/:id */
export const deleteVendorHandler = async (c: Context) => {
  const id = Number(c.req.param("id"));
  const result = await deleteVendor(c.get("tenantPrisma"), id);
  return c.json(result);
};

/** DELETE /vendor/batch */
export const batchDeleteVendorHandler = async (c: Context) => {
  const { id }: VendorBatchDelete = await c.req.json();
  const result = await batchDeleteVendors(c.get("tenantPrisma"), id);
  return c.json(result);
};

/** PUT /vendor/:id */
export const updateVendorHandler = async (c: Context) => {
  const id = Number(c.req.param("id"));
  const body: UpdateVendorBody = await c.req.json();
  const result = await updateVendor(
    c.get("tenantPrisma"),
    c.get("user")!.userId,
    id,
    body,
  );
  return c.json(result);
};
