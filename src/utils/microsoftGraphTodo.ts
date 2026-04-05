const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export type GraphFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

/**
 * 调用 Microsoft Graph To Do 相关接口（与官方「查询」语义一致）。
 * @see https://learn.microsoft.com/en-us/graph/api/resources/todo-overview
 */
export async function graphTodoRequest<T>(
  path: string,
  accessToken: string,
  query?: Record<string, string | undefined>,
): Promise<GraphFetchResult<T>> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  if (!res.ok) {
    const err = body as { error?: { message?: string; code?: string } };
    const message =
      err?.error?.message ??
      err?.error?.code ??
      `Graph 请求失败 HTTP ${res.status}`;
    return { ok: false, status: res.status, message };
  }

  return { ok: true, data: body as T };
}
