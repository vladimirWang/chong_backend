import { randomBytes } from "node:crypto";
import prisma from "../../utils/prisma";
import { getPaginationValues } from "../../utils/db";
import { auditUpdateConnect } from "../../utils/auditUser";
import { createModuleLogger } from "../../utils/logger";
import {
  ErrorResponse,
  SuccessResponse,
  errorCode,
} from "../../models/Response";
import type { AuthUser } from "../../types/auth";
import type { Pagination } from "../../validators/commonValidator";
import type {
  ApproveApplicationBody,
  CheckInviteCodeBody,
  SendInviteCodeBody,
} from "./applicantValidator";

const logger = createModuleLogger("applicant");

/**
 * 公开申请接口没有登录态，审计字段需要一个系统管理员 id。
 * 与老架构一致从 ANONYMOUS_EMAIL 对应的 AdminUser 取，查不到退回 0。
 */
async function getAnonymousAdminUserId(): Promise<number> {
  const email = process.env.ADMIN_EMAIL;
  if (email) {
    const admin = await prisma.adminUser.findFirst({ where: { email } });
    if (admin) return admin.id;
  }
  return 0;
}

/**
 * 提交申请（获取邀请码），公共路由
 *
 * join  型：传 tenantCode，查到租户后写入 applicant.tenantId，由该租户 superUser 审核
 * create 型：传 tenantName，tenantId 留空，由系统管理员审核
 */
export async function sendInviteCode(body: SendInviteCodeBody) {
  const { email, tenantCode, tenantName } = body;

  const userExisted = await prisma.user.findFirst({ where: { email } });
  if (userExisted) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "邮箱已注册");
  }

  // create 型：提前校验租户名未被占用
  if (tenantName) {
    const nameExisted = await prisma.tenant.findUnique({
      where: { name: tenantName },
    });
    if (nameExisted) {
      return new ErrorResponse(errorCode.VALIDATION_ERROR, "租户名称已存在");
    }
  }

  // join 型：校验 tenantCode 有效且租户 ACTIVE
  let tenantId: number | undefined;
  if (tenantCode) {
    const tenant = await prisma.tenant.findUnique({
      where: { code: tenantCode },
    });
    if (!tenant) {
      return new ErrorResponse(errorCode.VALIDATION_ERROR, "租户编码不存在");
    }
    if (tenant.status !== "ACTIVE") {
      return new ErrorResponse(errorCode.VALIDATION_ERROR, "租户已停用");
    }
    tenantId = tenant.id;
  }

  const anonymousUserId = await getAnonymousAdminUserId();
  await prisma.applicant.create({
    data: {
      email,
      // join 型关联租户；create 型存 tenantName
      ...(tenantId ? { tenant: { connect: { id: tenantId } } } : {}),
      ...(tenantName ? { tenantName } : {}),
      createdByUser: {
        connect: {
          id: anonymousUserId,
        }
      },
      updatedByUser: {
        connect: {
          id: anonymousUserId,
        }
      }
    },
  });

  return new SuccessResponse(null, "申请成功，请等待审核");
}

/**
 * 校验邀请码（注册时使用），公共路由
 */
export async function checkInviteCode(body: CheckInviteCodeBody) {
  const { email } = body;
  const application = await prisma.applicant.findUnique({
    where: { email },
  });
  if (!application) {
    return new ErrorResponse(
      errorCode.APPLICATION_NOT_FOUND,
      "未收到系统权限申请",
    );
  }
  return new SuccessResponse(null, "邀请码验证通过");
}

/**
 * 申请人分页列表（需登录）
 *
 * - 系统管理员（role=admin）：查看全部申请人（含 create 型）
 * - 租户 superUser（role=merchant + isSuperUser）：只查看本租户的申请人
 * - 普通租户用户：无权访问
 */
export async function getApplicants(
  query: Pagination,
  user: AuthUser | undefined,
) {
  if (!user) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "未登录");
  }

  // 普通租户用户无权查看申请人列表
  if (user.role === "merchant" && !user.isSuperUser) {
    return new ErrorResponse(errorCode.FORBIDDEN, "仅租户超级管理员可查看申请人列表");
  }

  const { limit, page, pagination = "1" } = query;
  let skip: number | undefined;
  let take: number | undefined;
  if (pagination) {
    const paginationInfo = getPaginationValues({
      limit: limit ?? 20,
      page: page ?? 1,
    });
    skip = paginationInfo.skip;
    take = paginationInfo.take;
  }

  // 管理员看全部；租户 superUser 只看本租户
  const where =
    user.role === "merchant" && user.tenantId != null
      ? { tenantId: user.tenantId }
      : {};

  const [list, total] = await Promise.all([
    prisma.applicant.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    }),
    prisma.applicant.count({ where }),
  ]);
  return new SuccessResponse({ total, list }, "获取申请人列表成功");
}

/**
 * 权限校验：
 * - create 型（applicant.tenantId 为空）：仅系统管理员可审核
 * - join 型（applicant.tenantId 有值）：仅该租户 superUser 可审核
 */
function checkApprovePermission(
  applicant: { tenantId: number | null },
  user: AuthUser | undefined,
): ErrorResponse<unknown> | null {
  if (!user) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "未登录");
  }
  // 管理员可审核所有申请（含 create 型）
  if (user.role === "admin") return null;
  // join 型：仅本租户 superUser 可审核
  if (applicant.tenantId != null) {
    if (user.tenantId !== applicant.tenantId) {
      return new ErrorResponse(errorCode.FORBIDDEN, "无权审核其他租户的申请");
    }
    if (!user.isSuperUser) {
      return new ErrorResponse(errorCode.FORBIDDEN, "仅租户超级管理员可审核");
    }
  } else {
    // create 型：仅系统管理员可审核
    return new ErrorResponse(errorCode.FORBIDDEN, "仅系统管理员可审核新建租户申请");
  }
  return null;
}

/**
 * 审核核心逻辑（事务内）：审核通过即创建 User（无密码，身份信息由 SSO 管理）
 *
 * - create 型：创建 ACTIVE 租户 + 创建 User + 绑定 superUserId + 回写 tenantId
 * - join 型：直接创建 User（关联已有租户）
 * - 申请人状态直接置为 ACTIVATED（不再有"审核→激活"两步流程）
 *
 * 幂等：where status not ACTIVATED 防止重复审核（已 ACTIVATED 的 update 不匹配会抛 P2025 触发回滚）
 */
async function approveApplicantCore(
  applicant: { id: number; email: string; tenantId: number | null; tenantName: string | null },
  auditUserId: number,
): Promise<void> {
  const { id, email } = applicant;
  await prisma.$transaction(
    async (tx) => {
      // 更新申请状态为 ACTIVATED（审核通过即建 User，一步到位）
      await tx.applicant.update({
        where: { id, status: { not: "ACTIVATED" } },
        data: {
          status: "ACTIVATED",
          ...auditUpdateConnect(auditUserId),
        },
      });

      if (applicant.tenantId == null) {
        // create 型：创建 ACTIVE 租户
        if (!applicant.tenantName) {
          throw new Error("申请缺少租户名称，无法创建租户");
        }
        const nameExisted = await tx.tenant.findUnique({
          where: { name: applicant.tenantName },
        });
        if (nameExisted) {
          throw new Error("租户名称已存在");
        }
        const newTenant = await tx.tenant.create({
          data: {
            name: applicant.tenantName,
            code: randomBytes(3).toString("hex"),
            status: "ACTIVE",
          },
        });
        await tx.applicant.update({
          where: { id },
          data: {
            tenant: { connect: { id: newTenant.id } },
          },
        });
        // 创建 User（无密码/username，身份信息由 SSO 管理）并绑定为租户超级管理员
        const newUser = await tx.user.create({
          data: {
            email,
            tenant: { connect: { id: newTenant.id } },
          },
        });
        await tx.tenant.update({
          where: { id: newTenant.id },
          data: { superUserId: newUser.id },
        });
      } else {
        // join 型：租户已存在，直接建 User
        const tenant = await tx.tenant.findUnique({ where: { id: applicant.tenantId } });
        if (!tenant) {
          throw new Error("租户不存在");
        }
        if (tenant.status === "SUSPENDED" || tenant.status === "DISABLED") {
          throw new Error("租户已停用");
        }
        await tx.user.create({
          data: {
            email,
            tenant: { connect: { id: applicant.tenantId } },
          },
        });
      }
    },
    {
      timeout: 30_000,
      maxWait: 10_000,
    },
  );
}

/**
 * 审核通过：事务内创建 User +（create 型创建租户并绑定 superUserId）
 * 用户身份信息（username/password/salt）统一由 SSO 管理，本系统不再存储
 *
 * 权限：申请人有 tenantId → 该租户 superUser 审核；无 tenantId（create 型）→ 管理员审核
 */
export async function approveApplication(
  body: ApproveApplicationBody,
  user: AuthUser | undefined,
) {
  const { id } = body;
  if (!user) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "未登录");
  }

  const applicant = await prisma.applicant.findUnique({ where: { id } });
  if (!applicant) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "申请人不存在");
  }

  const permError = checkApprovePermission(applicant, user);
  if (permError) return permError;

  // 审计字段引用 AdminUser 表：admin 用户直接用 userId，
  // merchant 用户（User 表）改用匿名 AdminUser ID 避免外键约束失败
  const auditUserId = user.role === "admin"
    ? user.userId
    : await getAnonymousAdminUserId();
  try {
    await approveApplicantCore(applicant, auditUserId);
  } catch (error) {
    logger.error(
      `approveApplication error: ${error instanceof Error ? error.stack ?? error.message : String(error)}`,
    );
    return new ErrorResponse(
      errorCode.SYSTEM_ERROR,
      "审核失败：数据库更新出错，已回滚",
    );
  }
  return new SuccessResponse(null, "审核通过，用户已创建，可通过 SSO 登录");
}

/**
 * 自动审核：定时任务调用，批量审核所有 PENDING 状态的申请
 * 审计用户使用 ANONYMOUS_EMAIL 对应的 AdminUser
 */
export async function autoApprovePendingApplications(): Promise<void> {
  const pendingApplicants = await prisma.applicant.findMany({
    where: { status: "PENDING" },
  });

  if (pendingApplicants.length === 0) {
    logger.info("自动审核任务：无待审核申请");
    return;
  }

  logger.info(`自动审核任务启动，待审核申请 ${pendingApplicants.length} 条`);

  const auditUserId = await getAnonymousAdminUserId();
  let successCount = 0;
  let failCount = 0;

  for (const applicant of pendingApplicants) {
    try {
      await approveApplicantCore(applicant, auditUserId);
      successCount++;
      logger.info(`自动审核成功: applicantId=${applicant.id}, email=${applicant.email}`);
    } catch (error) {
      failCount++;
      logger.error(
        `自动审核失败: applicantId=${applicant.id}, ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  logger.info(`自动审核任务完成: 成功 ${successCount} 条, 失败 ${failCount} 条`);
}

/**
 * 检查申请人邮箱是否存在，公共路由
 */
export async function checkApplicantExisted(email: string) {
  const applicant = await prisma.applicant.findUnique({
    where: { email },
  });
  const existed = Boolean(applicant);
  return new SuccessResponse(existed, `邮箱${existed ? "存在" : "不存在"}`);
}
