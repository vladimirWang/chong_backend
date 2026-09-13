import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createClientHandler,
  getClientDetailByIdHandler,
  getClientsHandler,
  patchClientHandler,
} from "./clientController";
import {
  clientQuerySchema,
  createClientBodySchema,
  patchClientBodySchema,
} from "./clientValidator";
import { updateIdSchema } from "../../validators/commonValidator";

/** 客户路由（均需登录，tenantPrisma 自动租户隔离） */
const clientRouter = new Hono()
  .get("/", zValidator("query", clientQuerySchema), getClientsHandler)
  .post("/", zValidator("json", createClientBodySchema), createClientHandler)
  .get("/:id", zValidator("param", updateIdSchema), getClientDetailByIdHandler)
  .patch(
    "/:id",
    zValidator("param", updateIdSchema),
    zValidator("json", patchClientBodySchema),
    patchClientHandler,
  );

export { clientRouter };
