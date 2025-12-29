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
}