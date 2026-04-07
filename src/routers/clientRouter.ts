import { Elysia } from "elysia";
import {
  getClients,
  createClient,
  patchClient,
  getClientDetailById,
} from "../controllers/clientController";
import {
  createClientBodySchema,
  patchClientBodySchema,
} from "../validators/clientValidator";
import { updateIdSchema, paginationSchema } from "../validators/commonValidator";
import { clientQuerySchema } from "../validators/clientValidator";
import { authService } from "../macro/auth.macro";

export const clientRouter = new Elysia({ prefix: "/client" })
  .use(authService)
  .guard({ isSignIn: true }, (app) =>
    app
      .get("/", getClients, {
        query: paginationSchema,
      })
      .post("/", createClient, {
        body: createClientBodySchema,
      })
      .patch("/:id", (ctx) => patchClient(ctx as any), {
        body: patchClientBodySchema,
        params: updateIdSchema,
      })
      .get("/:id", getClientDetailById, {
        params: updateIdSchema,
      }),
  );
