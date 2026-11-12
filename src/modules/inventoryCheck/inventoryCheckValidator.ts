import { z } from "zod";
import { paginationSchema } from "../../validators/commonValidator";

/** POST /inventoryCheck body：创建盘点单 */
export const createInventoryCheckBodySchema = z.object({
  name: z.string().min(1, "盘点单名称不可为空").max(50, "盘点单名称过长"),
  /** 盘点范围：按供应商/按产品过滤；两者都不传 = 全租户 */
  vendorIds: z.array(z.number().int().positive()).optional(),
  productIds: z.array(z.number().int().positive()).optional(),
  remark: z.string().max(255).optional(),
});
export type CreateInventoryCheckBody = z.infer<typeof createInventoryCheckBodySchema>;

/** GET /inventoryCheck query：列表查询 */
export const inventoryCheckQuerySchema = z
  .object({
    status: z.enum(["DRAFT", "COUNTING", "REVIEWING", "COMPLETED", "CANCELLED"]).optional(),
    /** 盘点单名称模糊搜索 */
    name: z.string().optional(),
  })
  .merge(paginationSchema);
export type InventoryCheckQuery = z.infer<typeof inventoryCheckQuerySchema>;

/** PUT /inventoryCheck/:id/items body：批量录入实盘数 */
export const inventoryCheckItemsBodySchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.number().int().positive(),
        actualQty: z.number().int().nonnegative("实盘数不能为负"),
        remark: z.string().max(255).optional(),
      }),
    )
    .min(1, "至少提交一条实盘数据"),
});
export type InventoryCheckItemsBody = z.infer<typeof inventoryCheckItemsBodySchema>;
