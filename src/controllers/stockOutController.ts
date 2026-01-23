import {CreateMultipleStockOut} from '../validators/stockOutValidator'
import {sum2} from '../utils/algo'
import {SuccessResponse} from '../models/Response'
import prisma from "../utils/prisma";

export const getStockOuts = async () => {
    const result = await prisma.stockOut.findMany()    
    const total = await prisma.stockOut.count()
    return JSON.stringify(new SuccessResponse({ list: result, total }, "出货记录列表获取成功"))
}

export const createMultipleStockOut = async ({
    body
}: {body: CreateMultipleStockOut}) => {
    const { productJoinStockOut, remark } = body
    const totalPrice = sum2(productJoinStockOut, 'price')
    await prisma.$transaction([
        prisma.stockOut.create({
            data: {
                totalPrice,
                remark,
                productJoinStockOut: {
                    create: productJoinStockOut.map(item => {
                        return {
                            price: item.price,
                            count: item.count,
                            product: {
                                connect: {
                                    id: item.productId
                                }
                            }
                        }
                    })
                }
            }
        })
    ])
    
    return JSON.stringify(new SuccessResponse(null, '出货创建成功'))
}

export const confirmStockOutCompleted = async({params}: {params: stockOutUpdateParams}) => {

}