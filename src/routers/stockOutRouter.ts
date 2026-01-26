import { Elysia } from "elysia";
import {
  getStockOuts,
  createMultipleStockOut,
  confirmStockOutCompleted,
  updateStockOut,
  getStockOutDetailById
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
      beforeHandle: async ({body}) => {
        // const productExisted = await prisma.product.findUnique({
        //   where: {
        //     id: params.id,
        //   },
        // });

        // if (!productExisted) {
        //   // 抛出 zod 异常，使用自定义错误消息
        //   throw new ZodError([
        //     {
        //       code: "custom",
        //       path: ["id"],
        //       message: "产品不存在",
        //     },
        //   ]);
        // }
      },
    })
    .put("/:id", updateStockOut, {
      params: updateIdSchema,
      body: multipleStockOutBodySchema,
    })
    .patch("/confirmCompleted/:id", confirmStockOutCompleted, {
      params: updateIdSchema,
      body: completedAtSchema
    })
    .get("/:id", getStockOutDetailById, {
      params: updateIdSchema,
    })
});
