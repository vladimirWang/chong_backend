import { Elysia } from "elysia";
import {getStockOuts, createMultipleStockOut} from '../controllers/stockOutController'
import {createMultipleStockOutSchema} from '../validators/stockOutValidator'
import {paginationSchema} from '../validators/commonValidator'

export const stockOutRouter = new Elysia()
    .group('/api/stockout', app => {
        return app.get("/", getStockOuts, {
            query: paginationSchema
        })
        .post("/multiple", createMultipleStockOut, {
            body: createMultipleStockOutSchema
        })
    })