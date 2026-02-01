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

// errorCode
export const errorCode = {
  EMAIL_EXISTED: 10001, // 邮箱已存在
  VALIDATION_ERROR: 10002, // 校验失败
  USER_NOT_FOUND: 10003, // 用户不存在
  NOT_FOUND: 10004, // 路由不存在
  VENDOR_HAS_PRODUCTS: 10005, // 供应商有关联产品
  CAPTCHA_EXPIRED: 10006, // 供应商有关联产品
  CAPTCHA_INCORRECT: 10007, // 供应商有关联产品
  PASSWORD_INCORRECT: 10008, // 密码不正确
  EMAIL_VALIDATION_FAIL: 10009, // 邮箱验证失败
  ACCOUNT_LOCKED: 10010, // 密码错账号锁定
};
