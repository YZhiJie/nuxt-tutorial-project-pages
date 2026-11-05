import { describe, expect, it } from 'vitest';
import {
    AuthValidationError,
    InvalidCredentialsError,
    authenticate,
} from '../../../server/services/auth/auth-service';
import { toApiErrorPayload } from '../../../server/utils/errors/api-error';

describe('authenticate', () => {
    it('演示账号返回用户', () => {
        expect(authenticate({ username: 'demo', password: 'nuxt1234' })).toEqual({ name: 'demo' });
    });

    it('用户名与密码被 trim 后仍可登录', () => {
        expect(authenticate({ username: '  demo  ', password: 'nuxt1234' })).toEqual({ name: 'demo' });
    });

    it('缺少字段抛出校验错误，并映射为 400 VALIDATION_FAILED', () => {
        expect(() => authenticate({ username: '', password: '' })).toThrow(AuthValidationError);

        const error = new AuthValidationError({ username: '用户名不能为空' });
        const payload = toApiErrorPayload(error, 'req-400');
        expect(payload.statusCode).toBe(400);
        expect(payload.data.error.code).toBe('VALIDATION_FAILED');
        expect(payload.data.error.details).toEqual({ username: '用户名不能为空' });
        expect(payload.data.error.requestId).toBe('req-400');
    });

    it('非对象入参按校验失败处理', () => {
        expect(() => authenticate(null)).toThrow(AuthValidationError);
        expect(() => authenticate({ username: 'demo' })).toThrow(AuthValidationError);
    });

    it('账号或密码错误抛出 401 UNAUTHORIZED 信封', () => {
        expect(() => authenticate({ username: 'demo', password: 'wrong' })).toThrow(
            InvalidCredentialsError,
        );

        const error = new InvalidCredentialsError();
        const payload = toApiErrorPayload(error);
        expect(payload.statusCode).toBe(401);
        expect(payload.data.error.code).toBe('UNAUTHORIZED');
        expect(payload.data.error.message).toBe('账号或密码错误');
    });
});
