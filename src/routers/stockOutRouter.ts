import { Elysia } from "elysia";
import {
  getStockOuts,
  createMultipleStockOut,
  confirmStockOutCompleted,
  updateStockOut,
} from "../controllers/stockOutController";
import {
  multipleStockOutBodySchema,
  createMultipleStockOutSchema,
} from "../validators/stockOutValidator";
import {
  paginationSchema,
  updateIdSchema,
  completedAtSchema
} from "../validators/commonValidator";

export const stockOutRouter = new Elysia().group("/api/stockout", (app) => {
  return app
    .get("/", getStockOuts, {
      query: paginationSchema,
    })
    .post("/multiple", createMultipleStockOut, {
      body: createMultipleStockOutSchema,
    })
    .put("/:id", updateStockOut, {
      params: updateIdSchema,
      body: multipleStockOutBodySchema,
      // beforeHandle: mutilpleProductExistedValidator,
    })
    .patch("/confirmCompleted/:id", confirmStockOutCompleted, {
      params: updateIdSchema,
      body: completedAtSchema
    });
});
