/**
 * 业务错误：handler 中 throw new BusinessError(code, message) 即可中断请求
 * 全局 onError 拦截后统一返回 HTTP 200 + { code, message, data: null }
 */
export class BusinessError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
    this.name = "BusinessError";
  }
}
