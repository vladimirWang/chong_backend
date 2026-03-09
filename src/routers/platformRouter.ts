import { Elysia } from "elysia";
import { getPlatforms } from "../controllers/platformController";

export const platformRouter = new Elysia({ prefix: "/platform" })
    .get("/", getPlatforms);