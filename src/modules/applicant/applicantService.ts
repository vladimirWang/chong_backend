import { randomBytes } from "node:crypto";
import dayjs from "dayjs";
import prisma from "../../utils/prisma";
import { getPaginationValues } from "../../utils/db";
import { auditCreate, auditCreateConnect, auditUpdate } from "../../utils/auditUser";
import { getRabbitChannel } from "../../utils/rabbitmq";
import { sendFrom } from "../../utils/mailer";
import {
  applicantExchange,
  applicationApproveRoutingKey,
} from "../../config/rabbitmq";
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

/** 交互式事务 client 类型（从扩展型 prisma 实例推导，与 $transaction 回调入参一致） */
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * 公开申请接口没有登录态，审计字段需要一个系统管理员 id。
 * 与老架构一致从 ANONYMOUS_EMAIL 对应的 AdminUser 取，查不到退回 0。
 */
async function getAnonymousAdminUserId(): Promise<number> {
  const email = process.env.ANONYMOUS_EMAIL;
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
 * 移植自 repo_backend checkInviteCode
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
 * 在事务内：生成新激活 token（7 天有效）+ 落一条 Mail + 通过 RabbitMQ 通知 worker 异步发信。
 * approve（首次审核）与 resend（重发链接）复用。
 */
async function issueActivationMail(
  tx: TxClient,
  applicantId: number,
  email: string,
  userId: number,
) {
  // 生成激活链接 token（只存 hash）
  const token = randomBytes(32).toString("hex");
  await tx.applicantActivationToken.create({
    data: {
      applicantId,
      tokenHash: token,
      expiresAt: dayjs().add(7, "day").toDate(),
      ...auditCreate(userId),
    },
  });
  const activatedLink = `${process.env.FRONTEND_URL}/#/applicant/activate?token=${token}`;
  const insertMail = await tx.mail.create({
    data: {
      title: "库存系统激活链接",
      content: `<p>激活链接为：<a href="${activatedLink}" target="_blank">前往填写用户信息</a>, 请尽快使用。</p>`,
      from: sendFrom,
      to: email,
    },
  });
  // 共享连接：DNS/建连只在首次发生，断线后自动懒重建
  const channel = await getRabbitChannel();
  await channel.assertExchange(applicantExchange, "topic", {
    durable: true,
  });
  console.log("insertMail.id: ", insertMail.id);
  const buf = JSON.stringify({ mailId: insertMail.id });
  channel.publish(
    applicantExchange,
    applicationApproveRoutingKey,
    Buffer.from(buf),
    { persistent: true },
  );
  console.log("publish success mailId: ", insertMail.id);
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
 * 审核通过：事务内创建激活 token + 更新申请状态 + 落一条 Mail，
 * 随后通过 RabbitMQ 通知 worker 异步发信
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
    await prisma.$transaction(
      async (tx) => {
        await tx.applicant.update({
          where: { id, status: { not: "APPROVED" } },
          data: {
            status: "APPROVED",
            ...auditUpdate(auditUserId),
          },
        });
        await issueActivationMail(tx, id, applicant.email, auditUserId);
      },
      {
        // 发信可能较慢，避免默认 timeout 过早中断
        timeout: 30_000,
        maxWait: 10_000,
      },
    );
  } catch (error) {
    console.error("approveApplication error: ", error);
    return new ErrorResponse(
      errorCode.SYSTEM_ERROR,
      "审核失败：数据库更新或发送邮件出错，已回滚",
    );
  }
  return new SuccessResponse(null, "审核通过， 邮件已发送");
}

/**
 * 重新发送激活链接（需管理员登录）
 *
 * 激活 token 存在数据库 ApplicantActivationToken 表（非 Redis），
 * 重发时在同一事务内把该申请人所有未使用/未作废的旧 token 置为 revokedAt，
 * 旧激活链接立即失效，再生成新 token 并发信。
 * 仅 APPROVED（已审核、尚未激活）状态允许重发。
 */
export async function resendActivationLink(
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

  if (applicant.status === "PENDING") {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "申请尚未审核，请先审核通过");
  }
  if (applicant.status === "REJECTED") {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "申请已驳回，无法重发");
  }
  if (applicant.status === "ACTIVATED") {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "该用户已激活，无需重发");
  }

  // 审计字段引用 AdminUser 表：merchant 用户改用匿名 AdminUser ID
  const auditUserId = user.role === "admin"
    ? user.userId
    : await getAnonymousAdminUserId();

  try {
    await prisma.$transaction(
      async (tx) => {
        // 作废旧 token：未使用且未作废的全部置为 revoked（旧激活链接立即失效）
        await tx.applicantActivationToken.updateMany({
          where: { applicantId: id, usedAt: null, revokedAt: null },
          data: {
            revokedAt: new Date(),
            ...auditUpdate(auditUserId),
          },
        });
        await issueActivationMail(tx, id, applicant.email, auditUserId);
      },
      {
        timeout: 30_000,
        maxWait: 10_000,
      },
    );
  } catch (error) {
    console.error("resendActivationLink error: ", error);
    return new ErrorResponse(
      errorCode.SYSTEM_ERROR,
      "重发失败：数据库更新或发送邮件出错，已回滚",
    );
  }
  return new SuccessResponse(null, "激活链接已重新发送");
}

/**
 * 检查申请人邮箱是否存在，公共路由
 * 移植自 repo_backend checkApplicantExisted
 */
export async function checkApplicantExisted(email: string) {
  const applicant = await prisma.applicant.findUnique({
    where: { email },
  });
  const existed = Boolean(applicant);
  return new SuccessResponse(existed, `邮箱${existed ? "存在" : "不存在"}`);
}
