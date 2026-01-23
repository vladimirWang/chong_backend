import { Elysia } from "elysia";
import {getStockOuts, createMultipleStockOut} from '../controllers/stockOutController'
import {createMultipleStockOutSchema} from '../validators/stockOutValidator'

export const stockOutRouter = new Elysia()
    .group('/api/stockout', app => {
        return app.get("/", getStockOuts)
        .post("/multiple", createMultipleStockOut, {
            body: createMultipleStockOutSchema
        })
    })