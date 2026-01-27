import { Elysia } from "elysia";
import {
  getStockOuts,
  createMultipleStockOut,
  confirmStockOutCompleted,
  updateStockOut,
  getStockOutDetailById,
} from "../controllers/stockOutController";
import {
  multipleStockOutBodySchema,
  createMultipleStockOutSchema,
} from "../validators/stockOutValidator";
import {
  paginationSchema,
  updateIdSchema,
  completedAtSchema,
} from "../validators/commonValidator";
import { ZodError } from "zod";

export const stockOutRouter = new Elysia().group("/api/stockout", (app) => {
  return app
    .get("/", getStockOuts, {
      query: paginationSchema,
    })
    .post("/multiple", createMultipleStockOut, {
      body: createMultipleStockOutSchema,
      beforeHandle: async ({ body }) => {
        // throw new ZodError([
        //   {
        //     code: "custom",
        //     path: ["id"],
        //     message: "产品超卖了",
        //   },
        // ]);
        // ----------
        const data = body.productJoinStockOut;
        const result = await Promise.all(
          data.map((item) => {
            return prisma.product.findUnique({
              where: {
                id: item.productId,
              },
            });
          }),
        );
        const balanceInvalid = data.some((item, index) => {
          console.log(item.count, result[index]);
          return item.count > result[index].balance;
        });
        if (balanceInvalid) {
          throw new ZodError([
            {
              code: "custom",
              path: ["id"],
              message: "产品超卖了",
            },
          ]);
        }
      },
    })
    .put("/:id", updateStockOut, {
      params: updateIdSchema,
      body: multipleStockOutBodySchema,
    })
    .patch("/confirmCompleted/:id", confirmStockOutCompleted, {
      params: updateIdSchema,
      body: completedAtSchema,
    })
    .get("/:id", getStockOutDetailById, {
      params: updateIdSchema,
    });
});
