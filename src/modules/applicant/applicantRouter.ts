import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  approveApplicationHandler,
  checkApplicantExistedHandler,
  checkInviteCodeHandler,
  getApplicantsHandler,
  resendActivationLinkHandler,
  sendInviteCodeHandler,
} from "./applicantController";
import { paginationSchema } from "../../validators/commonValidator";
import {
  approveApplicationBodySchema,
  checkInviteCodeBodySchema,
  paramEmailSchema,
  sendInviteCodeBodySchema,
} from "./applicantValidator";

/**
 * 申请人路由
 * 公共：sendInviteCode / checkInviteCode / checkApplicantExisted（在 authMiddleware 白名单放行）
 * 需登录：GET /（列表）、POST /approve（审核）、POST /resend（重发激活链接）
 */
const applicantRouter = new Hono()
  .post(
    "/sendInviteCode",
    zValidator("json", sendInviteCodeBodySchema),
    sendInviteCodeHandler,
  )
  .post(
    "/checkInviteCode",
    zValidator("json", checkInviteCodeBodySchema),
    checkInviteCodeHandler,
  )
  .get(
    "/checkApplicantExisted/:email",
    zValidator("param", paramEmailSchema),
    checkApplicantExistedHandler,
  )
  .get("/", zValidator("query", paginationSchema), getApplicantsHandler)
  .post(
    "/approve",
    zValidator("json", approveApplicationBodySchema),
    approveApplicationHandler,
  )
  .post(
    "/resend",
    zValidator("json", approveApplicationBodySchema),
    resendActivationLinkHandler,
  );

export { applicantRouter };
