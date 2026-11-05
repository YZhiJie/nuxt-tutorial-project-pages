import { API_ERROR_CODES } from '../../../shared/contracts/api';
import type { AuthUser, LoginInput } from '../../../shared/types/auth';

/** 入参不合法（400）：把字段级原因放进 details，形状与 notes 的校验错误一致 */
export class AuthValidationError extends Error {
    readonly code = API_ERROR_CODES.VALIDATION_FAILED;
    readonly details: Record<string, string>;

    constructor(details: Record<string, string>, message = '登录参数校验失败') {
        super(message);
        this.name = 'AuthValidationError';
        this.details = details;
    }
}

/** 账号或密码错误（401）：不区分「用户不存在」与「密码错」，避免账号枚举 */
export class InvalidCredentialsError extends Error {
    readonly code = API_ERROR_CODES.UNAUTHORIZED;

    constructor(message = '账号或密码错误') {
        super(message);
        this.name = 'InvalidCredentialsError';
    }
}

/**
 * 纯函数：校验登录入参并返回用户。
 * 不依赖 h3，便于 Vitest 直接覆盖；handler 只负责读 body、写 cookie、转错误信封。
 */
export function authenticate(input: Partial<LoginInput> | null | undefined): AuthUser {
    const username = typeof input?.username === 'string' ? input.username.trim() : '';
    const password = typeof input?.password === 'string' ? input.password : '';

    const details: Record<string, string> = {};
    if (!username) details.username = '用户名不能为空';
    if (!password) details.password = '密码不能为空';
    if (Object.keys(details).length > 0) {
        throw new AuthValidationError(details);
    }

    if (username !== 'demo' || password !== 'nuxt1234') {
        throw new InvalidCredentialsError();
    }
    return { name: username };
}
