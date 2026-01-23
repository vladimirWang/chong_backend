import prisma from "../utils/prisma";
import { SuccessResponse } from "../models/Response";
import {
  SingleStockInBody,
  MultipleStockInBody,
  StockInParams,
  stockInUpdateParams,
} from "../validators/stockInValidator";
import { compareArrayMinLoop, luhn } from "../utils/algo";
import _ from 'lodash'

// 获取进货记录列表
export const getStockIns = async () => {
  const result = await prisma.stockIn.findMany();
  const total = await prisma.stockIn.count();
  return JSON.stringify(
    new SuccessResponse({ list: result, total }, "进货记录列表获取成功")
  );
};

// 单个产品进货
export const createSingleStockIn = async ({
  body,
}: {
  body: SingleStockInBody;
}) => {
  const { productId, cost, count, remark } = body;
  const res = await prisma.stockIn.create({
    data: {
      remark,
      totalCost: cost * count,
      productJoinStockIn: {
        create: [
          {
            cost,
            count,
            product: {
              connect: {
                id: productId,
              },
            },
          },
        ],
      },
    },
  });
  return JSON.stringify(new SuccessResponse(null, "进货记录新建成功"));
};

// 批量产品进货
export const createMultipleStockIn = async ({
  body,
}: {
  body: MultipleStockInBody;
}) => {
  // 合并相同 productId 和 cost 的数据，count 相加
  // [{productId: 1, cost: 10, count: 10}, {productId: 1, cost: 10, count: 30}]
  // => [{productId: 1, cost: 10, count: 40}]
  const mergedMap = new Map<string, { productId: number; cost: number; count: number }>();
  const productIds = [];
  body.productJoinStockIn.forEach((item) => {
    productIds.push(item.productId);
    const key = `${item.productId}-${item.cost}`;
    const existing = mergedMap.get(key);
    if (existing) {
      existing.count += item.count;
    } else {
      mergedMap.set(key, {
        productId: item.productId,
        cost: item.cost,
        count: item.count,
      });
    }
  });

  // 转换为数组
  const mergedProductJoinStockIn = Array.from(mergedMap.values());

  const totalCost = mergedProductJoinStockIn.reduce((a, c) => {
    return a + c.cost * c.count;
  }, 0);

  // 查询所有产品信息（包括 vendorId）

  const uniqueProductIds = [...new Set(productIds)];
  const products = await prisma.product.findMany({
    where: {
      id: {
        in: uniqueProductIds,
      },
    },
    select: {
      id: true,
      vendorId: true,
    },
  });

  // 创建产品 id 到产品信息的映射
  const productMap = new Map<number, { id: number; vendorId: number }>(
    products.map((p: { id: number; vendorId: number }) => [p.id, p])
  );

  const results = await prisma.$transaction([
    // 创建进库记录
    prisma.stockIn.create({
      data: {
        // remark: body.remark,
        totalCost,
        productJoinStockIn: {
          create: mergedProductJoinStockIn.map((item) => {
            return {
              cost: item.cost,
              count: item.count,
              product: {
                connect: {
                  id: item.productId,
                },
              },
              historyCost: {
                create: {
                  value: item.cost,
                  productId: item.productId,
                },
              },
            };
          }),
        },
      },
    }),
    // 修改库存并生成产品编码
    ...body.productJoinStockIn.map((item) => {
      const product = productMap.get(item.productId);
      // 如果产品存在且有 vendorId，生成产品编码
      const updateData: {
        balance: { increment: number };
        productCode?: string;
        latestCost?: number;
      } = {
        balance: {
          increment: item.count,
        },
        latestCost: item.cost,
      };

      // TODO 正确处理判空
      const productCode = luhn(product!);
      updateData.productCode = productCode;

      return prisma.product.update({
        data: updateData,
        where: {
          id: item.productId,
        },
      });
    }),
  ]);
  return JSON.stringify(
    new SuccessResponse(results, "进货记录批量新建成功")
  );
};

// 根据ID获取进货记录
export const getStockInById = async ({
  params,
}: {
  params: StockInParams;
}) => {
  const { id } = params;
  const result = await prisma.stockIn.findUnique({
    where: {
      id,
    },
    select: {
      remark: true,
      productJoinStockIn: true,
    },
  });
  return JSON.stringify(new SuccessResponse(result, "进货记录查询成功"));
};
interface ProductInfo {
  count: number;
  cost: number;
}
type StockInLineComparable = {
  id?: number;
  stockInId?: number;
  productId: number;
  cost: number;
  count: number;
};
export const updateStockIn = async (
  {
  params,
  body
}
: {
  params: stockInUpdateParams,
  body: MultipleStockInBody
}
) => {
  // 查询已有数据
  const existedRecord = await prisma.productJoinStockIn.findMany({
    where: {
      stockInId: params.id
    }
  })
  console.log("prosudt: ", existedRecord)
  // return 'hhehh  '+params.id + '; length: ' +body.productJoinStockIn.length
  const {productJoinStockIn} = body;
  const totalCost = productJoinStockIn.reduce((a, c) => a + c.cost * c.count, 0);
  const existedComparable: StockInLineComparable[] = existedRecord.map((r) => ({
    id: r.id,
    stockInId: r.stockInId,
    productId: r.productId,
    cost: r.cost,
    count: r.count,
  }));
  const newComparable: StockInLineComparable[] = productJoinStockIn.map((r) => ({
    productId: r.productId,
    cost: r.cost,
    count: r.count,
  }));
  const {added,modified, deleted, unchanged} = compareArrayMinLoop<StockInLineComparable>(
    existedComparable,
    newComparable,
    'productId',
    ['id', 'stockInId']
  )
  console.log("modified: ", modified)
  
  const existedInfoMap: Record<number, ProductInfo> = existedRecord.reduce((a: Record<number, ProductInfo>, c) => {
    a[c.productId] = {
      count: c.count,
      cost: c.cost
    }
    return a
  }, {})
  const deletedJoinIds = deleted
    .map((item) => item.id)
    .filter((id): id is number => typeof id === "number");

  await prisma.$transaction([
    // 删除被移除商品对应的历史成本（即使有级联，也做显式兜底）
    prisma.historyCost.deleteMany({
      where: {
        productJoinStockInId: {
          in: deletedJoinIds,
        },
      },
    }),
    // 更新进货记录
    prisma.stockIn.update({
      where: {
        id: params.id
      },
      data: {
        totalCost,
        // 更新中间表
        productJoinStockIn: {
          // 新增原本没有的记录
          create: added.map((item) => {
            return {
              cost: item.cost,
              count: item.count,
              product: {
                connect: {
                  id: item.productId,
                },
              },
              historyCost: {
                create: {
                  value: item.cost,
                  productId: item.productId,
                },
              },
            };
          }),
          // 更新原本已有的数据
          update: modified.map(item => {
            return {
              where: {
                stockInId_productId: {
                  stockInId: params.id,
                  productId: item.productId
                }
              },
              data: {
                cost: item.cost,
                count: item.count,
                historyCost: {
                  upsert: {
                    create: {
                      value: item.cost,
                      productId: item.productId,
                    },
                    update: {
                      value: item.cost,
                      productId: item.productId,
                    },
                  },
                },
              }
            }
          }),
          deleteMany: deleted.map(item => {
            return {
              // TODO 解决没有属性id的问题
              // id: item.id!
              stockInId: params.id,
              productId: item.productId
            }
          })
        }
      }
    }),
    // 更新产品库存和最新成本价-对新增的商品
    // 不管新增还是编辑已有商品，最新成本都是直接赋值
    // TODO 删除进货中某个商品时，要把最新成本还原到前一次，多加一个表来实现
    ...(added.map(item => {
      return prisma.product.update({
        where: {
          id: item.productId
        },
        data: {
          balance: {
            increment: item.count,
          },
          latestCost: item.cost
        }
      })
    })),
    // 更新产品库存-对修改的商品
    ...(modified.map(item => {
      console.log("updated balance: ", item.count, existedInfoMap[item.productId].count)
      return prisma.product.update({
        where: {
          id: item.productId
        },
        data: {
          balance: {
            increment: item.count - existedInfoMap[item.productId].count
          },
          latestCost: item.cost
        }
      })
    })),
    // 更新产品库存-对删除的商品
    ...(deleted.map(item => {
      return prisma.product.update({
        where: {
          id: item.productId
        },
        data: {
          balance: {
            increment: -1 * existedInfoMap[item.productId].count
          },
          latestCost: item.cost
        }
      })
    }))
  ])
  return JSON.stringify(new SuccessResponse(null, "进货单更新成功"))
}

export const confirmCompleted = async ({params}: {params: stockInUpdateParams}) => {
  const record = await prisma.stockIn.update({
    where: {
      id: params.id
    },
    data: {
      status: 'COMPLETED',
      completedAt: new Date()
    }
  })
  console.log("record: ", record)
  return JSON.stringify(new SuccessResponse(record, "进货单确认成功"))
}