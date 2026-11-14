import { z } from "zod";
import { paginationSchema } from "../../validators/commonValidator";

/** 售后类型：退货 / 换货 / 返修 */
export const afterSalesTypeSchema = z.enum(["RETURN", "EXCHANGE", "REPAIR"]);

/** 售后单状态 */
export const afterSalesStatusSchema = z.enum([
  "PENDING",
  "MERCHANT_RECEIVED",
  "COMPLETED",
  "CANCELLED",
]);

/**
 * 明细行：只提交出货明细行的逻辑外键 stockOutItemId 与本次数量，
 * 产品/规格/单价/供应商均由后端从出货明细行快照。
 */
export const afterSalesLineSchema = z.object({
  /** 逻辑外键：ProductJoinStockOut.id */
  stockOutItemId: z.number().int().positive(),
  count: z.number().int().positive(),
  /** 仅 REPAIR 有意义：单件维修费用 */
  repairFee: z.number().int().nonnegative().optional(),
  remark: z.string().max(255).optional(),
});

/** POST /afterSales body：创建售后单 */
export const createAfterSalesBodySchema = z.object({
  /** 逻辑外键：StockOut.id */
  stockOutId: z.number().int().positive(),
  type: afterSalesTypeSchema,
  items: z.array(afterSalesLineSchema).min(1, "至少提交一条明细"),
  reason: z.string().max(255).optional(),
  remark: z.string().max(255).optional(),
  docs: z.array(z.string()).optional(),
});
export type CreateAfterSalesBody = z.infer<typeof createAfterSalesBodySchema>;

/** GET /afterSales query：列表查询 */
export const afterSalesQuerySchema = z
  .object({
    type: afterSalesTypeSchema.optional(),
    status: afterSalesStatusSchema.optional(),
    /** 售后单号模糊搜索 */
    serviceCode: z.string().optional(),
    /** 关联出货单号模糊搜索 */
    stockOutServiceCode: z.string().optional(),
  })
  .merge(paginationSchema);
export type AfterSalesQuery = z.infer<typeof afterSalesQuerySchema>;

/** GET /afterSales/stockOutOptions query：可关联出货单搜索 */
export const stockOutOptionsQuerySchema = z.object({
  keyword: z.string().optional(),
});
export type StockOutOptionsQuery = z.infer<typeof stockOutOptionsQuerySchema>;

/** GET /afterSales/stockOut/:stockOutId/available 路径参数 */
export const stockOutIdParamSchema = z.object({
  stockOutId: z.coerce.number().int().positive(),
});
export type StockOutIdParam = z.infer<typeof stockOutIdParamSchema>;

/**
 * PATCH /afterSales/:id/confirmMerchant body：商家接收确认
 * - RETURN：可同时提交退款金额（支持部分退款，0 ~ totalPrice）
 * - EXCHANGE/REPAIR：仅时间点确认
 */
export const confirmMerchantBodySchema = z.object({
  receivedAt: z.coerce.date().optional(),
  refundAmount: z.number().int().nonnegative().optional(),
});
export type ConfirmMerchantBody = z.infer<typeof confirmMerchantBodySchema>;

/** PATCH /afterSales/:id/confirmCustomer body：客户收货确认 */
export const confirmCustomerBodySchema = z.object({
  receivedAt: z.coerce.date().optional(),
});
export type ConfirmCustomerBody = z.infer<typeof confirmCustomerBodySchema>;
