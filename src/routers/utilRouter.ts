import { Elysia, t } from "elysia";
import { uploadFile, uploadExcelFile } from "../controllers/uploadController";

export const utilRouter = new Elysia({
  prefix: "/util",
}).get(
  "/upload",
  async ({ body }) => {
    const result = await uploadFile({ file: body.file });
    return JSON.parse(result);
  },
  {
    body: t.Object({
      file: t.File({ format: "image/*" }),
    }),
  },
);
