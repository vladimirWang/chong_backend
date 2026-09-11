/**
 * 业务可预期的 HTTP 异常：service 层抛出，全局 onError 统一转成 ErrorResponse
 * 用于需要非 200 状态码的场景（404/409/400 等），避免 service 直接依赖 hono Context
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: number,
    message: string,
    public data: unknown = null,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
