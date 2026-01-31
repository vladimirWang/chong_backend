import { Elysia, t } from "elysia";
import {z} from 'zod'
import { uploadFile, uploadExcelFile } from "../controllers/uploadController";
import { sendEmailVerificationCode, checkEmailValidation } from "../controllers/utilController";
import {sendVerificationSchema, checkEmailValidationSchema} from '../validators/utilValidator'

export const utilRouter = new Elysia({
  prefix: "/util",
})
  .get(
    "/upload",
    async ({ body }) => {
      const result = await uploadFile({ file: body.file });
      return JSON.parse(result);
    },
    {
      body: t.Object({
        file: t.File({ format: "image/*" }),
      }),
    }
  )
  .post("/sendEmailVerificationCode", sendEmailVerificationCode, {
    body: sendVerificationSchema
  }).post("/checkEmailValidation", checkEmailValidation, {
    body: checkEmailValidationSchema
  })
