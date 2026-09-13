import basePrisma from "../../utils/prisma";
import { SuccessResponse } from "../../models/Response";

/**
 * 平台业务层（移植自 repo_backend platformController）
 * Platform 是全局字典表（无 tenantId），所有租户共享，故用 basePrisma 而非 tenantPrisma；
 * 软删除扩展仍会自动过滤 deletedAt 非空的记录。
 */

/** GET /platform：全部平台（出货单选择平台用） */
export async function getPlatforms() {
  const platforms = await basePrisma.platform.findMany();
  return new SuccessResponse(platforms, "平台列表获取成功");
}
