import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";
import { graphTodoRequest } from "../utils/microsoftGraphTodo";

function normalizeHeaders(
  h: Record<string, string | undefined> | Headers,
): Record<string, string | undefined> {
  if (h instanceof Headers) {
    const out: Record<string, string | undefined> = {};
    h.forEach((v, k) => {
      out[k.toLowerCase()] = v;
    });
    return out;
  }
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(h)) {
    out[k.toLowerCase()] = v;
  }
  return out;
}

/** 委托权限访问令牌：来自 MS 登录 OAuth，或开发环境 MICROSOFT_GRAPH_ACCESS_TOKEN */
export function resolveMicrosoftGraphToken(
  headers: Record<string, string | undefined> | Headers,
): string | null {
  const nh = normalizeHeaders(headers);
  const fromHeader =
    nh["x-ms-graph-token"] ?? nh["authorization-ms"] ?? undefined;
  if (fromHeader?.trim()) return fromHeader.trim();
  const env = process.env.MICROSOFT_GRAPH_ACCESS_TOKEN?.trim();
  return env || null;
}

/** GET /me/todo/lists 及 OData 查询参数透传 */
export const getMicrosoftTodoLists = async ({
  headers,
  query,
}: {
  headers: Record<string, string | undefined> | Headers;
  query: Record<string, string | undefined>;
}) => {
  const token = resolveMicrosoftGraphToken(headers);
  if (!token) {
    return new ErrorResponse(
      errorCode.VALIDATION_ERROR,
      "缺少 Microsoft Graph 访问令牌：请在请求头设置 X-Ms-Graph-Token，或配置环境变量 MICROSOFT_GRAPH_ACCESS_TOKEN",
    );
  }

  const result = await graphTodoRequest<unknown>(
    "/me/todo/lists",
    token,
    query,
  );
  if (!result.ok) {
    return new ErrorResponse(errorCode.SYSTEM_ERROR, result.message);
  }
  return new SuccessResponse(result.data, "Microsoft To Do 列表查询成功");
};

/** GET /me/todo/lists/{listId}/tasks */
export const getMicrosoftTodoTasks = async ({
  headers,
  params,
  query,
}: {
  headers: Record<string, string | undefined> | Headers;
  params: { listId: string };
  query: Record<string, string | undefined>;
}) => {
  const token = resolveMicrosoftGraphToken(headers);
  if (!token) {
    return new ErrorResponse(
      errorCode.VALIDATION_ERROR,
      "缺少 Microsoft Graph 访问令牌：请在请求头设置 X-Ms-Graph-Token，或配置环境变量 MICROSOFT_GRAPH_ACCESS_TOKEN",
    );
  }

  const { listId } = params;
  if (!listId?.trim()) {
    return new ErrorResponse(errorCode.VALIDATION_ERROR, "listId 不能为空");
  }

  const result = await graphTodoRequest<unknown>(
    `/me/todo/lists/${encodeURIComponent(listId)}/tasks`,
    token,
    query,
  );
  if (!result.ok) {
    return new ErrorResponse(errorCode.SYSTEM_ERROR, result.message);
  }
  return new SuccessResponse(result.data, "Microsoft To Do 任务查询成功");
};
