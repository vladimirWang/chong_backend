import { Prisma } from "@prisma/client";
import prisma from "../../utils/prisma";
import { ErrorResponse, SuccessResponse, errorCode } from "../../models/Response";
import { createModuleLogger } from "../../utils/logger";
import type { AuthUser } from "../../types/auth";
import type { UpdateTenantBody } from "./tenantValidator";

const logger = createModuleLogger("tenant");

/** Tenant 是跨租户的全局表，统一用 basePrisma，不用 tenantPrisma */

/** logo 相对路径拼 PUBLIC_BASE_URL 前缀（与 product.img 处理方式一致） */
function withBaseUrl(logo: string | null): string | null {
  if (!logo) return null;
  return `${process.env.PUBLIC_BASE_URL ?? ""}${logo}`;
}

/**
 * GET /tenant/info：获取当前登录用户所属租户基本信息（名称、code、logo）
 * 任意租户用户可调（不限 superUser），用于侧边栏等展示
 */
export async function getTenantInfo(user: AuthUser | undefined) {
  if (!user?.tenantId) {
    return new ErrorResponse(errorCode.FORBIDDEN, "无所属租户");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { id: true, name: true, code: true, logo: true },
  });
  if (!tenant) {
    return new ErrorResponse(errorCode.TENANT_NOT_FOUND, "租户不存在");
  }

  return new SuccessResponse(
    { ...tenant, logo: withBaseUrl(tenant.logo) },
    "租户信息获取成功",
  );
}

/**
 * GET /tenant：获取当前登录用户所属租户完整信息
 * 仅租户超级管理员可访问（租户设置页面）
 */
export async function getTenantProfile(user: AuthUser | undefined) {
  if (!user?.tenantId || !user.isSuperUser) {
    return new ErrorResponse(errorCode.FORBIDDEN, "仅租户超级管理员可查看租户信息");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { id: true, name: true, code: true, logo: true, status: true, createdAt: true },
  });
  if (!tenant) {
    return new ErrorResponse(errorCode.TENANT_NOT_FOUND, "租户不存在");
  }

  return new SuccessResponse(
    { ...tenant, logo: withBaseUrl(tenant.logo) },
    "租户信息获取成功",
  );
}

/**
 * PUT /tenant：更新租户名称 / logo
 * 仅租户超级管理员可操作；name 保持全局唯一（排除自身）
 */
export async function updateTenantProfile(
  user: AuthUser | undefined,
  body: UpdateTenantBody,
) {
  if (!user?.tenantId || !user.isSuperUser) {
    return new ErrorResponse(errorCode.FORBIDDEN, "仅租户超级管理员可修改租户信息");
  }

  const data: Prisma.TenantUpdateInput = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.logo !== undefined) data.logo = body.logo;

  try {
    const updated = await prisma.tenant.update({
      where: { id: user.tenantId },
      data,
      select: { id: true, name: true, code: true, logo: true, status: true, updatedAt: true },
    });
    return new SuccessResponse(
      { ...updated, logo: withBaseUrl(updated.logo) },
      "租户信息更新成功",
    );
  } catch (error) {
    // P2002: name @unique 冲突
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return new ErrorResponse(errorCode.TENANT_NAME_EXISTED, "租户名称已存在");
    }
    // P2025: 租户记录不存在
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return new ErrorResponse(errorCode.TENANT_NOT_FOUND, "租户不存在");
    }
    logger.error(
      `[updateTenantProfile] ${error instanceof Error ? error.stack ?? error.message : String(error)}`,
    );
    return new ErrorResponse(errorCode.SYSTEM_ERROR, "更新租户信息失败");
  }
}
