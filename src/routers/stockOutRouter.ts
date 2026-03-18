import { Elysia } from "elysia";
import {
  getStockOuts,
  createMultipleStockOut,
  confirmStockOutCompleted,
  updateStockOut,
  getStockOutDetailById,
  batchDeleteStockOut,
  restoreDeletedStockOut,
} from "../controllers/stockOutController";
import {
  multipleStockOutBodySchema,
  createMultipleStockOutSchema,
  stockOutQuerySchema,
} from "../validators/stockOutValidator";
import {
  paginationSchema,
  updateIdSchema,
  completedAtSchema,
  idArray,
} from "../validators/commonValidator";
import { ZodError } from "zod";
import { batchDeleteStockInQuerySchema } from "../validators/stockInValidator";

export const stockOutRouter = new Elysia({ prefix: "/stockout" })
  .get("/", getStockOuts, {
    query: stockOutQuerySchema,
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
  })
  .delete("/batchDelete", batchDeleteStockOut, {
    query: batchDeleteStockInQuerySchema,
  })
  .post("/restoreDeleted", restoreDeletedStockOut, {
    body: idArray,
  });
