import { Elysia } from "elysia";
import {
  getMicrosoftTodoLists,
  getMicrosoftTodoTasks,
} from "../controllers/microsoftTodoController";
import {
  microsoftTodoListIdSchema,
  microsoftTodoODataQuerySchema,
} from "../validators/microsoftTodoValidator";

/**
 * Microsoft To Do（Microsoft Graph）查询代理。
 * 鉴权：本系统仍走 isSignIn；Graph 侧需带用户委托令牌 X-Ms-Graph-Token（OAuth 换得的 access_token）。
 */
export const microsoftTodoRouter = new Elysia({ prefix: "/microsoft/todo" })
  .get("/lists", getMicrosoftTodoLists, {
    query: microsoftTodoODataQuerySchema,
  })
  .get("/lists/:listId/tasks", getMicrosoftTodoTasks, {
    params: microsoftTodoListIdSchema,
    query: microsoftTodoODataQuerySchema,
  });
