import prisma, {TenantPrismaClient} from "../utils/prisma";
import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import { Prisma } from "@prisma/client";
import {
  SingleStockInBody,
  MultipleStockInBody,
  BatchDeleteStockInQuery,
  StockInQuery,
} from "../validators/stockInValidator";
import { compareArrayMinLoop, luhn } from "../utils/algo";
import _ from "lodash";
import {
  updateIdSchema,
  Pagination,
  DeletedStartEnd,
  IdArray,
  UpdateId,
  CompletedAt,
} from "../validators/commonValidator";
import dayjs from "dayjs";
import { getPaginationValues } from "../utils/db";
import { generateStockOperationSql } from "../sqlMap/stockOperation";
import { sum2 } from "../utils/algo";
import { generateServiceCode } from "../utils/common";
import type { AuthContext } from "./userController";
import {
  auditCreate,
  auditCreateConnect,
  auditSoftDelete,
  auditUpdate,
  auditUpdateConnect,
} from "../utils/auditUser";
import { AuthInject } from "../macro/auth.macro";

export type StockOperationListRow = {
  id: number;
  remark: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  submittedAt: Date;
  // totalCost: number;
  status: string;
  completedAt: Date | null;
  serviceCode: string;
};

export type StockInListRow = StockOperationListRow & {
  totalCost: number;
  productId: number;
  productName: string;
  cost: number;
  count: number;
  serviceCode: string;
};

type StockInContext = {
  tenantPrisma: TenantPrismaClient;
  query: StockInQuery;
} 

// 获取进货记录列表
export const getStockIns = async ({ query, tenantPrisma }: StockInContext) => {
  const {
    pagination = true,
    limit = 10,
    page = 1,
    deletedStart,
    deletedEnd,
    productName,
    vendorName,
    completedStart,
    completedEnd,
    isDeleted,
  } = query;
  const { skip, take } = getPaginationValues({ limit, page });

  const productNameStr =
    typeof productName === "string" ? productName.trim() : undefined;
  const vendorNameStr =
    typeof vendorName === "string" ? vendorName.trim() : undefined;

  // —— 构建 where 条件 —— //
  // tenantPrisma 自动注入 tenantId；软删除扩展自动注入 deletedAt: null（除非显式覆盖）
  const where: Prisma.StockInWhereInput = {};

  // 嵌套关系过滤：通过 ProductJoinStockIn → Product → Vendor 筛选
  if (productNameStr || vendorNameStr) {
    where.productJoinStockIn = {
      some: {
        product: {
          ...(productNameStr
            ? { name: { contains: productNameStr } }
            : {}),
          ...(vendorNameStr
            ? { vendor: { name: { contains: vendorNameStr } } }
            : {}),
        },
      },
    };
  }

  // deletedAt：显式指定时覆盖软删除扩展的默认 null 过滤
  if (deletedStart || deletedEnd) {
    where.deletedAt = {
      ...(deletedStart ? { gte: dayjs(deletedStart).toDate() } : {}),
      ...(deletedEnd ? { lte: dayjs(deletedEnd).toDate() } : {}),
    };
  } else if (isDeleted === "1") {
    where.deletedAt = { not: null };
  }
  // else: 不写 deletedAt → 软删除扩展自动加 deletedAt: null

  if (completedStart) {
    where.completedAt = {
      ...((where.completedAt as object) || {}),
      gte: dayjs(completedStart).toDate(),
    };
  }
  if (completedEnd) {
    where.completedAt = {
      ...((where.completedAt as object) || {}),
      lte: dayjs(completedEnd).toDate(),
    };
  }

  // —— 查询 —— //
  const [total, stockIns] = await Promise.all([
    tenantPrisma.stockIn.count({ where }),
    tenantPrisma.stockIn.findMany({
      where,
      ...(pagination ? { skip, take } : {}),
      orderBy: { updatedAt: "desc" },
      include: {
        productJoinStockIn: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  // —— 映射输出：与原 raw SQL 返回结构一致 —— //
  const list = stockIns.map((s) => ({
    id: s.id,
    remark: s.remark,
    createdAt: s.createdAt,
    submittedAt: s.submittedAt,
    updatedAt: s.updatedAt,
    deletedAt: s.deletedAt,
    status: s.status,
    completedAt: s.completedAt,
    totalCost: s.totalCost,
    serviceCode: s.serviceCode,
    products: s.productJoinStockIn.map((pjs) => ({
      productId: pjs.productId,
      productName: pjs.product?.name ?? "",
      cost: pjs.cost,
      count: pjs.count,
    })),
  }));

  return new SuccessResponse({ list, total }, "进货记录列表获取成功");
};

// 批量产品进货
export const createMultipleStockIn = async ({
  body,
  user,
  tenantPrisma,
}: AuthContext & AuthInject & {
  body: MultipleStockInBody;
}) => {
  if (!user) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "未登录");
  }
  const uid = user.userId;
  const tenantId = user.tenantId!;
  const { productJoinStockIn, submittedAt, remark } = body;

  const totalCost = sum2(productJoinStockIn, "cost");

  const submittedAtVal = submittedAt ? dayjs(submittedAt).toDate() : new Date();
  // 生成进货单号
  const { serviceCode } = await generateServiceCode("JH", "stockInCode");
  const results = await tenantPrisma.$transaction([
    // 创建进库记录（tenantPrisma 扩展自动注入 tenant connect + deletedAt 过滤）
    tenantPrisma.stockIn.create({
      data: {
        submittedAt: submittedAtVal,
        remark,
        totalCost,
        serviceCode,
        // 用关系语法（connect）与扩展注入的 tenant: { connect } 保持一致
        ...auditCreateConnect(uid),
        // tenantPrisma 扩展运行时会覆盖为正确 tenantId，此处仅为满足类型
        tenant: { connect: { id: tenantId } },
        productJoinStockIn: {
          create: productJoinStockIn.map((item) => {
            return {
              cost: item.cost,
              count: item.count,
              product: { connect: { id: item.productId } },
              vendor: { connect: { id: item.vendorId } },
              // 嵌套 create 不触发扩展，需手动指定 tenant
              tenant: { connect: { id: tenantId } },
              ...auditCreateConnect(uid),
            };
          }),
        },
      },
    }),
    // 修改待进库数（扩展自动在 where 加 tenantId 过滤）
    ...productJoinStockIn.map((item) => {
      return tenantPrisma.product.update({
        data: {
          stockInPending: {
            increment: item.count,
          },
          ...auditUpdate(uid),
        },
        where: {
          id: item.productId,
        },
      });
    }),
  ]);
  if (!results[0]) {
    return new ErrorResponse(
      errorCode.FAILED_TO_CREATE_STOCK_IN,
      "进货记录批量新建失败",
    );
  }
  return new SuccessResponse(
    results[0],
    "进货记录批量新建成功, 进货单号: " + serviceCode,
  );
};

// 根据ID获取进货记录
export const getStockInById = async ({ params, tenantPrisma }: { params: UpdateId, tenantPrisma: TenantPrismaClient }) => {
  const { id } = params;
  const result = await tenantPrisma.stockIn.findUnique({
    where: {
      id,
    },
    include: {
      productJoinStockIn: true,
    },
  });
  return new SuccessResponse(result, "进货记录查询成功");
};
interface StockInInfo {
  count: number;
  cost: number;
}

export interface CommonStockLineComparable {
  id?: number;
  productId: number;
  count: number;
  vendorId: number;
}
type StockInLineComparable = CommonStockLineComparable & {
  stockInId?: number;
  cost: number;
  vendorId: number;
};

// 更新进货单
export const updateStockIn = async ({
  params,
  body,
  user,
  tenantPrisma
}: AuthContext & {
  params: UpdateId;
  body: MultipleStockInBody;
  tenantPrisma: TenantPrismaClient
}) => {
  if (!user) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "未登录");
  }
  const uid = user.userId;
  // 查询已有数据
  const existedRecord = await tenantPrisma.productJoinStockIn.findMany({
    where: {
      stockInId: params.id,
    },
  });
  // return 'hhehh  '+params.id + '; length: ' +body.productJoinStockIn.length
  const { productJoinStockIn, submittedAt, remark } = body;
  const totalCost = productJoinStockIn.reduce(
    (a, c) => a + c.cost * c.count,
    0,
  );
  const existedComparable: StockInLineComparable[] = existedRecord.map((r) => ({
    id: r.id,
    stockInId: r.stockInId,
    productId: r.productId,
    cost: r.cost,
    count: r.count,
    vendorId: r.vendorId,
  }));
  console.log("----existedComparable----: ", existedComparable);
  const newComparable: StockInLineComparable[] = productJoinStockIn.map(
    (r) => ({
      productId: r.productId,
      cost: r.cost,
      count: r.count,
      vendorId: r.vendorId,
    }),
  );
  const { added, modified, deleted, unchanged } =
    compareArrayMinLoop<StockInLineComparable>(
      existedComparable,
      newComparable,
      "productId",
      ["id", "stockInId"],
    );

  const existedInfoMap: Record<number, StockInInfo> = existedRecord.reduce(
    (a: Record<number, StockInInfo>, c) => {
      a[c.productId] = {
        count: c.count,
        cost: c.cost,
      };
      return a;
    },
    {},
  );
  const deletedJoinIds = deleted
    .map((item) => item.id)
    .filter((id): id is number => typeof id === "number");

  await tenantPrisma.$transaction([
    // 更新进货记录
    tenantPrisma.stockIn.update({
      where: {
        id: params.id,
      },
      data: {
        totalCost,
        submittedAt,
        remark,
        ...auditUpdateConnect(uid),
      },
    }),
    // 新增中间表记录
    ...added.map((item) => {
      return tenantPrisma.productJoinStockIn.create({
        data: {
          cost: item.cost,
          count: item.count,
          productId: item.productId,
          vendorId: item.vendorId,
          stockInId: params.id,
          ...auditCreate(uid),
        },
      });
    }),
    // 更新中间表记录
    ...modified.map((item) => {
      return tenantPrisma.productJoinStockIn.update({
        where: {
          stockInId_productId: {
            stockInId: params.id,
            productId: item.productId,
          },
        },
        data: {
          cost: item.cost,
          count: item.count,
          ...auditUpdateConnect(uid),
        },
      });
    }),
    // 删除中间表记录
    ...deleted.map((item) => {
      return tenantPrisma.productJoinStockIn.delete({
        where: {
          stockInId_productId: {
            stockInId: params.id,
            productId: item.productId,
          },
        },
      });
    }),
    // 更新产品待进库-对新增的商品
    // 不管新增还是编辑已有商品
    // TODO 删除进货中某个商品时，要把最新成本还原到前一次，多加一个表来实现
    ...added.map((item) => {
      return tenantPrisma.product.update({
        where: {
          id: item.productId,
        },
        data: {
          stockInPending: {
            increment: item.count,
          },
          ...auditUpdate(uid),
        },
      });
    }),
    // 更新产品库存-对修改的商品
    ...modified.map((item) => {
      return tenantPrisma.product.update({
        where: {
          id: item.productId,
        },
        data: {
          stockInPending: {
            increment: item.count - existedInfoMap[item.productId].count,
          },
          ...auditUpdate(uid),
        },
      });
    }),
    // 更新产品库存-对删除的商品
    ...deleted.map((item) => {
      return tenantPrisma.product.update({
        where: {
          id: item.productId,
        },
        data: {
          stockInPending: {
            increment: -1 * existedInfoMap[item.productId].count,
          },
          ...auditUpdate(uid),
        },
      });
    }),
  ]);
  return new SuccessResponse(null, "进货单更新成功");
};

// 确认收货
export const confirmCompleted = async ({
  params,
  body,
  user,
  tenantPrisma,
}: AuthContext & AuthInject & {
  params: UpdateId;
  body: CompletedAt;
}) => {
  if (!user) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "未登录");
  }
  const uid = user.userId;
  const tenantId = user.tenantId!;
  const relatedProducts = await tenantPrisma.productJoinStockIn.findMany({
    where: {
      stockInId: params.id,
    },
  });

  const { completedAt = new Date() } = body || {};
  const record = await tenantPrisma.$transaction([
    // 改进货单状态（扩展自动在 where 加 tenantId；data 全用关系语法避免冲突）
    tenantPrisma.stockIn.update({
      where: {
        id: params.id,
      },
      data: {
        status: "COMPLETED",
        completedAt,
        ...auditUpdateConnect(uid),
      },
    }),
    // 改产品表，把待进货加到库存数中
    ...relatedProducts.map((item) => {
      return tenantPrisma.product.update({
        where: {
          id: item.productId,
        },
        data: {
          balance: {
            increment: item.count,
          },
          stockInPending: {
            increment: -1 * item.count,
          },
          latestCost: item.cost,
          // 统一用关系语法
          ...auditUpdateConnect(uid),
        },
      });
    }),
    // 新增历史成本（扩展注入 tenant.connect 与标量 FK 冲突，全部用关系语法）
    ...relatedProducts.map((item) => {
      return tenantPrisma.historyCost.create({
        data: {
          value: item.cost,
          tenant: { connect: { id: tenantId } },
          product: { connect: { id: item.productId } },
          stockIn: { connect: { id: params.id } },
          ...auditCreateConnect(uid),
        },
      });
    }),
  ]);
  return new SuccessResponse(record, "进货单确认成功");
};

async function getValidsAndPendingCount(
  ids: number[],
  isDeleted: boolean = false,
) {
  // 只处理「未完成、未删除」的进货单，避免把已经完成的单子反向扣 pending
  const pendingStockIns = await tenantPrisma.stockIn.findMany({
    where: {
      id: {
        in: ids,
      },
      status: "PENDING",
      deletedAt: isDeleted
        ? {
            not: null,
          }
        : null,
    },
    select: {
      id: true,
    },
  });

  const validIds = pendingStockIns.map((s) => s.id);

  // return { validIds: [], pendingCount: {} };

  if (validIds.length === 0) {
    return { validIds: [], pendingCount: {} };
  }

  // 查出所有关联的中间表记录，用于统计每个商品需要扣减的 stockInPending 数量
  const joinRows = await tenantPrisma.productJoinStockIn.findMany({
    where: {
      stockInId: {
        in: validIds,
      },
      deletedAt: isDeleted
        ? {
            not: null,
          }
        : null,
    },
    select: {
      productId: true,
      count: true,
    },
  });

  const pendingCount: Record<number, number> = {};
  joinRows.forEach((row) => {
    pendingCount[row.productId] =
      (pendingCount[row.productId] ?? 0) + row.count;
  });
  return { validIds, pendingCount };
}

export const batchDeleteStockIn = async ({
  query,
  user,
  tenantPrisma
}: AuthContext & {
  query: BatchDeleteStockInQuery;
  tenantPrisma: TenantPrismaClient;
}) => {
  if (!user) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "未登录");
  }
  const uid = user.userId;
  const ids = query.id as number[];

  if (!ids || ids.length === 0) {
    return new SuccessResponse(null, "没有需要删除的进货单");
  }

  const { validIds, pendingCount } = await getValidsAndPendingCount(ids, false);

  if (validIds.length === 0) {
    return new SuccessResponse(null, "没有符合条件的进货单可删除");
  }

  const now = new Date();

  const txResults = await tenantPrisma.$transaction([
    // 软删除进货单
    tenantPrisma.stockIn.updateMany({
      where: {
        id: {
          in: validIds,
        },
      },
      data: {
        ...auditSoftDelete(uid, now),
      },
    }),
    // 软删除中间表记录
    tenantPrisma.productJoinStockIn.updateMany({
      where: {
        stockInId: {
          in: validIds,
        },
        deletedAt: null,
      },
      data: {
        ...auditSoftDelete(uid, now),
      },
    }),
    // 扣减对应商品的 stockInPending
    ...Object.entries(pendingCount).map(([productId, totalCount]) =>
      tenantPrisma.product.update({
        where: {
          id: Number(productId),
        },
        data: {
          stockInPending: {
            decrement: totalCount,
          },
          ...auditUpdate(uid),
        },
      }),
    ),
  ]);

  return new SuccessResponse(txResults, "进货单批量删除成功");
};

export const restoreDeletedStockIn = async ({
  body,
  user,
  tenantPrisma
}: AuthContext & { body: IdArray, tenantPrisma: TenantPrismaClient }) => {
  if (!user) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "未登录");
  }
  const uid = user.userId;
  const ids = body.ids;
  if (!ids || ids.length === 0) {
    return new SuccessResponse(null, "没有需要恢复的进货单");
  }

  const { validIds, pendingCount } = await getValidsAndPendingCount(ids, true);
  if (validIds.length === 0) {
    return new SuccessResponse(null, "没有符合条件的进货单可恢复");
  }

  const txResults = await tenantPrisma.$transaction([
    // 软删除进货单
    tenantPrisma.stockIn.updateMany({
      where: {
        id: {
          in: validIds,
        },
      },
      data: {
        deletedAt: null,
        ...auditUpdate(uid),
      },
    }),
    // 软删除中间表记录
    tenantPrisma.productJoinStockIn.updateMany({
      where: {
        stockInId: {
          in: validIds,
        },
      },
      data: {
        deletedAt: null,
        ...auditUpdate(uid),
      },
    }),
    // 扣减对应商品的 stockInPending
    ...Object.entries(pendingCount).map(([productId, totalCount]) =>
      tenantPrisma.product.update({
        where: {
          id: Number(productId),
        },
        data: {
          stockInPending: {
            increment: totalCount,
          },
          ...auditUpdate(uid),
        },
      }),
    ),
  ]);

  return new SuccessResponse(txResults, "进货单恢复成功");
};
