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

export const applicantRouter = new Elysia({ prefix: "/applicant" })
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
