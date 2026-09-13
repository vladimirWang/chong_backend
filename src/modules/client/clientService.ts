import type { TenantPrismaClient } from "../../utils/prisma";
import { SuccessResponse, errorCode } from "../../models/Response";
import { HttpError } from "../../models/HttpError";
import { getPaginationValues, getWhereValues } from "../../utils/db";
import { auditCreateConnect, auditUpdate } from "../../utils/auditUser";
import type { AuthUser } from "../../types/auth";
import type {
  ClientQuery,
  CreateClientBody,
  PatchClientBody,
} from "./clientValidator";

/**
 * 客户业务层（移植自 repo_backend clientController）
 * 租户隔离 + 软删除。老架构 patch/detail 误用了裸 prisma（无 tenantId 过滤），
 * 这里统一改为 tenantPrisma，避免跨租户读写；并对更新补存在性校验（老架构直接抛 P2025）。
 */

/** GET /client：分页列表，name/tel/address 模糊过滤 */
export async function getClients(
  db: TenantPrismaClient,
  query: ClientQuery,
) {
  const { limit = 10, page = 1, name, tel, address, pagination = 1 } = query;
  const paginate = pagination !== 0;
  const { skip, take } = getPaginationValues({ limit, page });

  const whereValues = getWhereValues({ name, tel, address });

  const [list, total] = await db.$transaction([
    db.client.findMany({
      skip: paginate ? skip : undefined,
      take: paginate ? take : undefined,
      where: whereValues,
    }),
    db.client.count({ where: whereValues }),
  ]);

  return new SuccessResponse({ total, list }, "客户列表获取成功");
}

/** POST /client */
export async function createClient(
  db: TenantPrismaClient,
  user: AuthUser,
  body: CreateClientBody,
) {
  const { name, tel, address, remark } = body;
  const client = await db.client.create({
    data: {
      name,
      tel,
      address,
      remark,
      ...auditCreateConnect(user.userId),
    } as never, // tenant 由 tenantPrisma 扩展运行时注入
  });
  return new SuccessResponse(client, "客户创建成功");
}

/** PATCH /client/:id（客户须存在且属于当前租户） */
export async function patchClient(
  db: TenantPrismaClient,
  user: AuthUser,
  id: number,
  body: PatchClientBody,
) {
  const existed = await db.client.findUnique({ where: { id } });
  if (!existed) {
    throw new HttpError(404, errorCode.NOT_FOUND, "客户不存在");
  }

  const { name, tel, address, remark } = body;
  const client = await db.client.update({
    where: { id },
    data: { name, tel, address, remark, ...auditUpdate(user.userId) },
  });
  return new SuccessResponse(client, "客户更新成功");
}

/** GET /client/:id */
export async function getClientDetailById(
  db: TenantPrismaClient,
  id: number,
) {
  const client = await db.client.findUnique({ where: { id } });
  return new SuccessResponse(client, "客户详情查询成功");
}
