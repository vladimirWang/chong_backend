import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import { getPaginationValues } from "../utils/db";
import { sendEmail, sendFrom } from "../utils/mailer";
import prisma from "../utils/prisma";
import type { AuthContext } from "./userController";
import {applicantExchange, applicationApproveRoutingKey} from '../config/rabbitmq'
import {getRabbitChannel} from '../utils/rabbitmq'
import {
  auditCreate,
  auditUpdate,
  // systemAuditUserId,
} from "../utils/auditUser";
import { Pagination, ParamEmail } from "../validators/commonValidator";
import { ParamEmailNotExisted } from "../validators/merchantCommonValidator";
import { CheckInviteCodeBody } from "../validators/userValidator";
import { ApproveApplicationBody } from "../validators/applicantValidator";
import { randomBytes } from "node:crypto";
import dayjs from "dayjs";
import { ApplicationStatus } from "@prisma/client";
import type { AppElysiaStore } from "../types/elysiaAppStore";

// 获取邀请码
export const sendInviteCode = async ({
  body,
  store,
}: {
  body: ParamEmailNotExisted;
  store: AppElysiaStore;
}) => {
  const { email, tenantName } = body;

  await prisma.applicant.create({
    data: {
      email,
      // 创建型场景存新租户名称，激活时据此创建 Tenant
      ...(tenantName ? { tenantName } : {}),
      ...auditCreate(store.anonymousUserId),
    },
  });

  return new SuccessResponse(null, "申请成功，请等待审核");
};

export const checkInviteCode = async ({
  body,
}: {
  body: CheckInviteCodeBody;
}) => {
  const { email, inviteCode } = body;
  // const inviteCodeRedisKey = genInviteCodeRedisKey(email);
  // const inviteCodeInRedis = await redisClient.get(inviteCodeRedisKey);
  // await redisClient.del(inviteCodeRedisKey);
  const application = await prisma.applicant.findUnique({
    where: {
      email,
      // inviteCode,
    },
  });
  if (!application) {
    return new ErrorResponse(
      errorCode.APPLICATION_NOT_FOUND,
      "未收到系统权限申请",
    );
  }
  // if (application.inviteCode !== inviteCode) {
  //   return new ErrorResponse(
  //     errorCode.INVITE_CODE_INVALID,
  //     "邀请码不正确或已过期",
  //   );
  // }
  return new SuccessResponse(null, "邀请码验证通过");
};

export const getApplicants = async ({ query }: { query: Pagination }) => {
  const { limit, page, pagination = "1" } = query;
  let skip = undefined,
    take = undefined;
  if (pagination) {
    const paginationInfo = getPaginationValues({
      limit: limit ?? 20,
      page: page ?? 1,
    });
    skip = paginationInfo.skip;
    take = paginationInfo.take;
  }
  const applicants = await prisma.applicant.findMany({
    orderBy: {
      updatedAt: "desc",
    },
    skip,
    take,
  });
  const total = await prisma.product.count();
  return new SuccessResponse({ total, list: applicants }, "获取申请人列表成功");
};

// 审核申请人
export const approveApplication = async ({
  body,
  user,
}: AuthContext & {
  body: ApproveApplicationBody;
}) => {
  const { id, applicant } = body;

  // // 发送邀请码到邮箱
  // // await sendEmail(email, "邀请码", `您的邀请码为：${rndCode}, 请尽快使用。`);
  // let inviteCode;
  // try {
  //   inviteCode = generateRndCode();
  // } catch (error) {
  //   return new ErrorResponse(errorCode.SYSTEM_ERROR, "生成邀请码失败");
  // }

  try {
    // 交互式事务：update 与 sendEmail 同属一次事务边界；任一步抛错则整笔回滚（含已执行的 update）
    await prisma.$transaction(
      async (tx) => {
        // 生成激活链接
        const token = randomBytes(32).toString("hex");
        await tx.applicantActivationToken.create({
          data: {
            applicantId: id,
            tokenHash: token,
            expiresAt: dayjs().add(7, "day").toDate(),
            // applicant: {
            //   connect: {
            //     id,
            //   },
            // },
            ...auditCreate(user.userId),
          },
        });
        await tx.applicant.update({
          where: { id, status: {
            not: ApplicationStatus.APPROVED
          } },
          data: {
            status: ApplicationStatus.APPROVED,
            // inviteCode,
            ...auditUpdate(user.userId),
          },
        });
        const activatedLink = `${process.env.FRONTEND_URL}/#/applicant/activate?token=${token}`;
        const insertMail = await tx.mail.create({
          data: {
            title: "库存系统激活链接",
            content: `<p>激活链接为：<a href="${activatedLink}" target="_blank">前往填写用户信息</a>, 请尽快使用。</p>`,
            from: sendFrom,
            to: applicant.email
          }
        })
        // 共享连接：DNS/建连只在首次发生，断线后自动懒重建
        const channel = await getRabbitChannel()
        await channel.assertExchange(applicantExchange, 'topic', {
          durable: true,
        })
        console.log("insertMail.id: ", insertMail.id, '; mail: ', insertMail.id)
        const buf = JSON.stringify({mailId: insertMail.id})
        channel.publish(applicantExchange, applicationApproveRoutingKey, Buffer.from(buf), {persistent: true})
        console.log("publish success mailId: ", insertMail.id)
        // const activatedLink = "https://www.iqiyi.com/u/record";
        // await sendEmail(
        //   applicant.email,
        //   "库存系统激活链接",
        //   `<p>激活链接为：<a href="${activatedLink}" target="_blank">前往填写用户信息</a>, 请尽快使用。</p>`,
        // );
        // await new Promise((r, r2) => {
        //   setTimeout(r2, 3000);
        // });
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
};

export const generateRndCode = (length: number = 6) => {
  if (length < 6 || length > 10) {
    throw new Error("随机码长度必须在6到10之间");
  }
  const rnd = Math.random();
  const rndCode = (rnd + "").slice(2, length);
  return rndCode;
};

export const checkApplicantExisted = async ({
  params,
}: {
  params: ParamEmail;
}) => {
  const { email } = params;
  const applicant = await prisma.applicant.findUnique({
    where: { email },
  });
  return new SuccessResponse(
    Boolean(applicant),
    `邮箱${applicant ? "存在" : "不存在"}`,
  );
};
