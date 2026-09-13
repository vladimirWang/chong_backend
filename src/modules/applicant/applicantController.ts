import type { Context } from "hono";
import {
  approveApplication,
  checkApplicantExisted,
  checkInviteCode,
  getApplicants,
  sendInviteCode,
} from "./applicantService";
import type { Pagination } from "../../validators/commonValidator";
import type {
  ApproveApplicationBody,
  CheckInviteCodeBody,
  ParamEmail,
  SendInviteCodeBody,
} from "./applicantValidator";

/**
 * POST /applicant/sendInviteCode：提交申请（公共路由）
 */
export const sendInviteCodeHandler = async (c: Context) => {
  const body = c.req.valid("json" as never) as SendInviteCodeBody;
  return c.json(await sendInviteCode(body));
};

/**
 * POST /applicant/checkInviteCode：校验邀请码（公共路由）
 */
export const checkInviteCodeHandler = async (c: Context) => {
  const body = c.req.valid("json" as never) as CheckInviteCodeBody;
  return c.json(await checkInviteCode(body));
};

/**
 * GET /applicant：申请人分页列表（需管理员登录）
 */
export const getApplicantsHandler = async (c: Context) => {
  const query = c.req.valid("query" as never) as Pagination;
  return c.json(await getApplicants(query));
};

/**
 * POST /applicant/approve：审核通过（需管理员登录）
 */
export const approveApplicationHandler = async (c: Context) => {
  const body = c.req.valid("json" as never) as ApproveApplicationBody;
  return c.json(await approveApplication(body, c.get("user")));
};

/**
 * GET /applicant/checkApplicantExisted/:email：申请人邮箱是否已存在（公共路由）
 */
export const checkApplicantExistedHandler = async (c: Context) => {
  const { email } = c.req.valid("param" as never) as ParamEmail;
  return c.json(await checkApplicantExisted(email));
};
