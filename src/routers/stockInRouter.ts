import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { z, ZodError } from "zod";
const { JWT_SECRET } = process.env;

export const stockInRouter = new Elysia()
// .use(
//   jwt({
//     name: "jwt",
//     secret: JWT_SECRET!,
//   })
// )
.group('/api/stockin', (app) => {
    return app.get("/", () => {
        return 'hello stock'
    })
})
