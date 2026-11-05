// API 错误码规范：前端与服务端共享，避免各自拼字符串
export const API_ERROR_CODES = {
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    NOT_FOUND: 'NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    INTERNAL: 'INTERNAL',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

// 错误码到 HTTP 状态码的唯一映射；不要在 handler 里另写一套
export const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
    [API_ERROR_CODES.VALIDATION_FAILED]: 400,
    [API_ERROR_CODES.NOT_FOUND]: 404,
    [API_ERROR_CODES.UNAUTHORIZED]: 401,
    [API_ERROR_CODES.INTERNAL]: 500,
};

/** 鉴权失败的统一领域错误：供中间件与 handler 共用同一错误信封 */
export class AuthRequiredError extends Error {
    readonly code = API_ERROR_CODES.UNAUTHORIZED;

    constructor(message = '请先登录') {
        super(message);
        this.name = 'AuthRequiredError';
    }
}

export interface ApiErrorBody {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, string>;
    requestId?: string;
}

// 错误响应固定形状：{ error: ApiErrorBody }
export interface ApiErrorResponse {
    error: ApiErrorBody;
}
