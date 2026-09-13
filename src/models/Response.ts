export class Response<T> {
  code: number;
  message: string;
  data: T | null;
  constructor(code: number, message: string, data: T | null) {
    this.code = code;
    this.message = message;
    this.data = data;
  }
}
export class SuccessResponse<T> extends Response<T> {
  constructor(data: T, message: string = "success") {
    super(200, message, data);
  }
}
export class ErrorResponse<T> extends Response<T> {
  constructor(code: number, message: string) {
    super(code, message, null);
  }
}

// errorCode（数值与 repo_backend 保持一致，便于前端/客户端复用）
export const errorCode = {
  EMAIL_EXISTED: 10001, // 邮箱已存在
  VALIDATION_ERROR: 10002, // 校验失败
  USER_NOT_FOUND: 10003, // 用户不存在
  NOT_FOUND: 10004, // 路由不存在
  VENDOR_HAS_PRODUCTS: 10005, // 供应商有关联产品
  CAPTCHA_EXPIRED: 10006, // 验证码已过期
  CAPTCHA_INCORRECT: 10007, // 验证码不正确
  PASSWORD_INCORRECT: 10008, // 密码不正确
  ACCOUNT_LOCKED: 10010, // 账号锁定
  NONCE_INVALID: 10011, // nonce无效
  FAILED_TO_CREATE_STOCK_IN: 10012, // 创建进货单失败
  FAILED_TO_CREATE_STOCK_OUT: 10016, // 创建出货单失败
  PRODUCT_NOT_FOUND: 10017, // 产品不存在
  INTERNAL_ERROR: 10019, // 服务器内部错误
};
