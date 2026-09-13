import type { Context } from "hono";
import { getPlatforms } from "./platformService";

/** GET /platform */
export const getPlatformsHandler = async (c: Context) => {
  return c.json(await getPlatforms());
};
