import { Elysia } from "elysia";
import {
  getClients,
  createClient,
  patchClient,
  getClientDetailById
} from "../controllers/clientController";
import {
  createClientBodySchema,
  patchClientBodySchema,
} from "../validators/clientValidator";
import { updateIdSchema, paginationSchema } from "../validators/commonValidator";
import { clientQuerySchema } from "../validators/clientValidator";

export const clientRouter = new Elysia({ prefix: "/client" })
  .get("/", getClients, {
    query: paginationSchema
  })
  .post("/", createClient, {
    body: createClientBodySchema,
  })
  .patch("/:id", patchClient, {
    body: patchClientBodySchema,
    params: updateIdSchema,
  }).get("/:id", getClientDetailById, {
    params: updateIdSchema,
  })
