import {z} from 'zod'

export const createMultipleStockOutSchema = z.object({
    productJoinStockOut: z.array(
        z.object({
            price: z.number(),
            count: z.number(),
            productId: z.number()
        })
    ),
    remark: z.string().optional()
})

export type CreateMultipleStockOut = z.infer<createMultipleStockOutSchema>