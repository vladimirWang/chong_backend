import type { Context } from "hono";
import {
  createClient,
  getClientDetailById,
  getClients,
  patchClient,
} from "./clientService";
import type {
  ClientQuery,
  CreateClientBody,
  PatchClientBody,
} from "./clientValidator";
import type { UpdateId } from "../../validators/commonValidator";

/** GET /client */
export const getClientsHandler = async (c: Context) => {
  const query = c.req.valid("query" as never) as ClientQuery;
  return c.json(await getClients(c.get("tenantPrisma"), query));
};

/** POST /client */
export const createClientHandler = async (c: Context) => {
  const body = c.req.valid("json" as never) as CreateClientBody;
  return c.json(
    await createClient(c.get("tenantPrisma"), c.get("user")!, body),
  );
};

/** PATCH /client/:id */
export const patchClientHandler = async (c: Context) => {
  const { id } = c.req.valid("param" as never) as UpdateId;
  const body = c.req.valid("json" as never) as PatchClientBody;
  return c.json(
    await patchClient(c.get("tenantPrisma"), c.get("user")!, id, body),
  );
};

/** GET /client/:id */
export const getClientDetailByIdHandler = async (c: Context) => {
  const { id } = c.req.valid("param" as never) as UpdateId;
  return c.json(await getClientDetailById(c.get("tenantPrisma"), id));
};
