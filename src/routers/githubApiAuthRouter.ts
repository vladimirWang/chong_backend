import { Elysia, t } from "elysia";
import {
  startGithubOAuth,
  callbackGithubOAuth,
  exchangeGithubOAuth,
} from "../controllers/githubOAuthController";

/**
 * 与常见网关路径对齐的 GitHub OAuth 入口（例如 https://hetou.vip/api/auth/github/callback）。
 * 与 /nodejs_api/user/oauth/github* 行为相同；GitHub App 的 callback URL 须与 GITHUB_REDIRECT_URI 一致。
 */
export const githubApiAuthRouter = new Elysia({ prefix: "/api/auth" })
  .get("/github/callback", ({ query, jwt }) => callbackGithubOAuth({ query, jwt }))
  .get("/github", ({ query }) => startGithubOAuth({ query }))
  .post(
    "/github/exchange",
    ({ body }) => exchangeGithubOAuth({ body }),
    {
      body: t.Object({
        exchange: t.String({ minLength: 1 }),
      }),
    },
  );
