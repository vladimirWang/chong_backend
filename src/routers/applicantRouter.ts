import { Elysia, t } from "elysia";
import {
  checkInviteCode,
  getApplicants,
  sendInviteCode,
  approveApplication,
} from "../controllers/applicantController";
import { paramEmailNotExistedSchema } from "../validators/merchantCommonValidator";
import { checkInviteCodeBodySchema } from "../validators/userValidator";
import { paginationSchema } from "../validators/commonValidator";
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
  });
