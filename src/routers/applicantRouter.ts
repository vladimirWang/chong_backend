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

export const applicantRouter = new Elysia({ prefix: "/applicant" })
  .post("/sendInviteCode", sendInviteCode, {
    body: paramEmailNotExistedSchema,
  })
  .post("/checkInviteCode", checkInviteCode, {
    body: checkInviteCodeBodySchema,
  })
  .get("/", getApplicants, {
    query: paginationSchema,
  })
  .post("/approve", approveApplication, {
    body: approveApplicationBodySchema,
  })
  .get("/checkApplicantExisted/:email", checkApplicantExisted, {
    params: paramEmailSchema,
  });
