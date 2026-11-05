import type { H3Event } from 'h3';
import {
    API_ERROR_CODES,
    API_ERROR_STATUS,
    type ApiErrorCode,
    type ApiErrorResponse,
} from '../../../shared/contracts/api';

interface DomainErrorShape {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, string>;
}

export interface ApiErrorPayload {
    statusCode: number;
    message: string;
    data: ApiErrorResponse;
}

function isDomainError(error: unknown): error is DomainErrorShape {
    if (typeof error !== 'object' || error === null) return false;
    const candidate = error as { code?: unknown; message?: unknown };
    return (
        typeof candidate.code === 'string' &&
        Object.hasOwn(API_ERROR_STATUS, candidate.code) &&
        typeof candidate.message === 'string'
    );
}

/**
 * 纯函数：把任意错误映射成 HTTP 状态码 + 统一错误信封。
 * 独立出来便于 Vitest 直接覆盖，不依赖 h3 运行时。
 */
export function toApiErrorPayload(error: unknown, requestId?: string): ApiErrorPayload {
    const domain = isDomainError(error)
        ? error
        : { code: API_ERROR_CODES.INTERNAL, message: '服务器内部错误' };

    return {
        statusCode: API_ERROR_STATUS[domain.code],
        message: domain.message,
        data: {
            error: {
                code: domain.code,
                message: domain.message,
                details: domain.details,
                requestId,
            },
        },
    };
}

/**
 * 把 service 抛出的业务错误收敛成统一响应：
 * { statusCode, statusMessage, stack, data: { error: { code, message, details, requestId } } }
 *
 * 未识别的错误一律按 INTERNAL 处理，避免把内部堆栈/细节透给客户端。
 */
export function toApiError(event: H3Event, error: unknown) {
    const requestId = (event.context as { requestId?: string }).requestId;
    return createError(toApiErrorPayload(error, requestId));
}
