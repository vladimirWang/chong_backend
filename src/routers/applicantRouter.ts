import { Elysia, t } from "elysia";
import {
  checkInviteCode,
  getApplicants,
  sendInviteCode,
  approveApplication,
  checkApplicantExisted,
} from "../controllers/applicantController";
import { paramEmailNotExistedSchema } from "../validators/merchantCommonValidator";
import { checkInviteCodeBodySchema } from "../validators/userValidator";
import {
  paginationSchema,
  paramEmailSchema,
} from "../validators/commonValidator";
import { approveApplicationBodySchema } from "../validators/applicantValidator";
import { authService } from "../macro/auth.macro";

/** 仅占位：根 app 已写入真实 id 时，append 合并不会覆盖 */
export const applicantStoreShape = new Elysia().state("anonymousUserId", 0);

export const applicantRouter = new Elysia({ prefix: "/applicant" })
  .use(applicantStoreShape)
  .use(authService)
  .post("/sendInviteCode", sendInviteCode, {
    body: paramEmailNotExistedSchema,
  })
  .post("/checkInviteCode", checkInviteCode, {
    body: checkInviteCodeBodySchema,
  })
  .get("/checkApplicantExisted/:email", checkApplicantExisted, {
    params: paramEmailSchema,
  });

applicantRouter.guard({ isSignIn: true }, (app) =>
  app
    .get("/", getApplicants, {
      query: paginationSchema,
    })
    .post("/approve", approveApplication, {
      body: approveApplicationBodySchema,
    }),
);
