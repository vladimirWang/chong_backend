import { Hono } from "hono";
import { generateCaptchaHandler, getNonceHandler } from "./utilController";

const utilRouter = new Hono()
  .get("/get-nonce", getNonceHandler)
  .get("/captcha", generateCaptchaHandler);

export { utilRouter };
