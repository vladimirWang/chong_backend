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
 * 移植自 repo_backend sendInviteCode
 */
export async function sendInviteCode(body: SendInviteCodeBody) {
  const { email, tenantName } = body;

  const userExisted = await prisma.user.findFirst({ where: { email } });
  if (userExisted) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "邮箱已注册");
  }

  const anonymousUserId = await getAnonymousAdminUserId();
  // const anonymousUserId = 1;
  await prisma.applicant.create({
    data: {
      email,
      // 创建型场景存新租户名称，激活时据此创建 Tenant
      ...(tenantName ? { tenantName } : {}),
      // tenantName: '123',
      // ...auditCreate(anonymousUserId),
      // ...auditCreateConnect(anonymousUserId),
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
 * 申请人分页列表（需管理员登录）
 * 移植自 repo_backend getApplicants
 */
export async function getApplicants(query: Pagination) {
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
  const [list, total] = await Promise.all([
    prisma.applicant.findMany({
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    }),
    prisma.applicant.count(),
  ]);
  return new SuccessResponse({ total, list }, "获取申请人列表成功");
}

/**
 * 审核通过：事务内创建激活 token + 更新申请状态 + 落一条 Mail，
 * 随后通过 RabbitMQ 通知 worker 异步发信（移植自 repo_backend approveApplication）
 */
export async function approveApplication(
  body: ApproveApplicationBody,
  user: AuthUser | undefined,
) {
  const { id } = body;
  if (!user) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "未登录");
  }

  // 老架构由 approveApplicationBodySchema 预查询注入 applicant，这里在 service 内查询
  const applicant = await prisma.applicant.findUnique({ where: { id } });
  if (!applicant) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "申请人不存在");
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        // 生成激活链接 token（只存 hash）
        const token = randomBytes(32).toString("hex");
        await tx.applicantActivationToken.create({
          data: {
            applicantId: id,
            tokenHash: token,
            expiresAt: dayjs().add(7, "day").toDate(),
            ...auditCreate(user.userId),
          },
        });
        await tx.applicant.update({
          where: { id, status: { not: "APPROVED" } },
          data: {
            status: "APPROVED",
            ...auditUpdate(user.userId),
          },
        });
        const activatedLink = `${process.env.FRONTEND_URL}/#/applicant/activate?token=${token}`;
        const insertMail = await tx.mail.create({
          data: {
            title: "库存系统激活链接",
            content: `<p>激活链接为：<a href="${activatedLink}" target="_blank">前往填写用户信息</a>, 请尽快使用。</p>`,
            from: sendFrom,
            to: applicant.email,
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
