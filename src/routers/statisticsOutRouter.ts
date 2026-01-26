import { Elysia } from "elysia";
import { getHotSales } from "../controllers/statisitcsController";
import { getHotSalesQuerySchema } from "../validators/statisticsValidator";

export const statisticsOutRouter = new Elysia().group(
  "/api/statistics",
  (app) => {
    return app.get("/hot-sales", getHotSales, {
      query: getHotSalesQuerySchema,
    });
  },
);
