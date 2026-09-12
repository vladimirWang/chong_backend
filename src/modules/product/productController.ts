import type { Context } from "hono";
import {
  checkProductNameExistedInVendor,
  createProduct,
  deleteProduct,
  getLatestSalePriceByProductId,
  getProductById,
  getProducts,
  getProductsByAmount,
  getProductsByVendorId,
  updateProduct,
} from "./productService";
import type {
  CreateProductBody,
  ProductAmountQuery,
  ProductQuery,
  UpdateProductBody,
} from "./productValidator";

/** GET /product */
export const getProductsHandler = async (c: Context) => {
  const query = c.req.valid("query" as never) as ProductQuery;
  return c.json(await getProducts(c.get("tenantPrisma"), query));
};

/** GET /product/:id */
export const getProductByIdHandler = async (c: Context) => {
  const id = Number(c.req.param("id"));
  return c.json(await getProductById(c.get("tenantPrisma"), id));
};

/** POST /product */
export const createProductHandler = async (c: Context) => {
  const body: CreateProductBody = await c.req.json();
  return c.json(
    await createProduct(c.get("tenantPrisma"), c.get("user")!, body),
  );
};

/** PATCH /product/:id */
export const updateProductHandler = async (c: Context) => {
  const id = Number(c.req.param("id"));
  const body: UpdateProductBody = await c.req.json();
  return c.json(
    await updateProduct(c.get("tenantPrisma"), c.get("user")!, id, body),
  );
};

/** DELETE /product/:id（占位） */
export const deleteProductHandler = (c: Context) => {
  const id = Number(c.req.param("id"));
  return c.json(deleteProduct(id));
};

/** GET /product/getProductsByVendorId/:vendorId */
export const getProductsByVendorIdHandler = async (c: Context) => {
  const vendorId = Number(c.req.param("vendorId"));
  return c.json(await getProductsByVendorId(c.get("tenantPrisma"), vendorId));
};

/** GET /product/getLatestSalePriceByProductId/:id */
export const getLatestSalePriceByProductIdHandler = async (c: Context) => {
  const id = Number(c.req.param("id"));
  return c.json(await getLatestSalePriceByProductId(c.get("tenantPrisma"), id));
};

/** GET /product/checkProductNameExistedInVendor/:vendorId?productName= */
export const checkProductNameExistedInVendorHandler = async (c: Context) => {
  const vendorId = Number(c.req.param("vendorId"));
  const { productName } = c.req.valid("query" as never) as {
    productName: string;
  };
  return c.json(
    await checkProductNameExistedInVendor(
      c.get("tenantPrisma"),
      vendorId,
      productName,
    ),
  );
};

/** GET /product/getProductsByAmount */
export const getProductsByAmountHandler = async (c: Context) => {
  const query = c.req.valid("query" as never) as ProductAmountQuery;
  return c.json(await getProductsByAmount(c.get("tenantPrisma"), query));
};
