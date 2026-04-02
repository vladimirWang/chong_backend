import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import { getPaginationValues } from "../utils/db";
import { sendEmail } from "../utils/mailer";
import prisma from "../utils/prisma";
import { Pagination } from "../validators/commonValidator";
import { ParamEmailNotExisted } from "../validators/merchantCommonValidator";
import { CheckInviteCodeBody } from "../validators/userValidator";
import { ApproveApplicationBody } from "../validators/applicantValidator";

// 获取邀请码
export const sendInviteCode = async ({
  body,
}: {
  body: ParamEmailNotExisted;
}) => {
  const { email } = body;

  await prisma.applicant.create({
    data: {
      email,
      // inviteCode: rndCode,
    },
  });
  // return new SuccessResponse(rndCode, "发送邀请码成功");
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
      inviteCode,
    },
  });
  if (!application) {
    return new ErrorResponse(
      errorCode.APPLICATION_NOT_FOUND,
      "未收到系统权限申请",
    );
  }
  if (application.inviteCode !== inviteCode) {
    return new ErrorResponse(
      errorCode.INVITE_CODE_INVALID,
      "邀请码不正确或已过期",
    );
  }
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
}: {
  body: ApproveApplicationBody;
}) => {
  const { id, applicant } = body;
  // const applicant = await prisma.applicant.findUnique({
  //   where: { id },
  // });
  // if (!applicant) {
  //   return new ErrorResponse(errorCode.APPLICATION_NOT_FOUND, "申请人不存在");
  // }

  // 发送邀请码到邮箱
  // await sendEmail(email, "邀请码", `您的邀请码为：${rndCode}, 请尽快使用。`);
  let inviteCode;
  try {
    inviteCode = generateRndCode();
  } catch (error) {
    return new ErrorResponse(errorCode.SYSTEM_ERROR, "生成邀请码失败");
  }
  try {
    // 交互式事务：update 与 sendEmail 同属一次事务边界；任一步抛错则整笔回滚（含已执行的 update）
    await prisma.$transaction(
      async (tx) => {
        await tx.applicant.update({
          where: { id },
          data: { status: "APPROVED", inviteCode },
        });
        await sendEmail(
          applicant.email,
          "邀请码",
          `您的邀请码为：${inviteCode}, 请尽快使用。`,
        );
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
  } catch {
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
