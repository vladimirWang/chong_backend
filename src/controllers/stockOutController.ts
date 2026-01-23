import {CreateMultipleStockOut} from '../validators/stockOutValidator'
import {sum2} from '../utils/algo'
import {SuccessResponse} from '../models/Response'

export const getStockOuts = () => {
    return 'get outs'
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