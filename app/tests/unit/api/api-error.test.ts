import { describe, expect, it } from 'vitest';
import { getApiErrorCode, getApiErrorMessage } from '../../../app/utils/api-error';
import { toApiErrorPayload } from '../../../server/utils/errors/api-error';
import { NoteNotFoundError } from '../../../server/services/notes/note-service';
import { AuthRequiredError } from '../../../shared/contracts/api';

describe('getApiErrorMessage', () => {
    it('优先使用新的 data.error.message', () => {
        expect(
            getApiErrorMessage({
                data: { error: { code: 'VALIDATION_FAILED', message: '标题不能为空' } },
            }),
        ).toBe('标题不能为空');
    });

    it('兼容旧版 data.message', () => {
        expect(
            getApiErrorMessage({ data: { message: '账号或密码错误' }, message: '401' }),
        ).toBe('账号或密码错误');
    });

    it('兼容旧版 data.statusMessage', () => {
        expect(getApiErrorMessage({ data: { statusMessage: '标题不能为空' } })).toBe(
            '标题不能为空',
        );
    });

    it('回退到错误 message', () => {
        expect(getApiErrorMessage({ message: '网络异常' })).toBe('网络异常');
    });

    it('无法识别时返回兜底文案', () => {
        expect(getApiErrorMessage(null, '登录失败，请稍后重试')).toBe('登录失败，请稍后重试');
    });
});

describe('toApiErrorPayload', () => {
    it('删除不存在的笔记映射为 404 + NOT_FOUND', () => {
        const payload = toApiErrorPayload(new NoteNotFoundError(99), 'req-404');

        expect(payload.statusCode).toBe(404);
        expect(payload.message).toBe('笔记 99 不存在');
        expect(payload.data.error).toMatchObject({
            code: 'NOT_FOUND',
            message: '笔记 99 不存在',
            requestId: 'req-404',
        });
    });

    it('鉴权失败映射为 401 + UNAUTHORIZED', () => {
        const payload = toApiErrorPayload(new AuthRequiredError(), 'req-401');

        expect(payload.statusCode).toBe(401);
        expect(payload.data.error).toMatchObject({
            code: 'UNAUTHORIZED',
            message: '请先登录',
        });
    });

    it('未知异常统一按 INTERNAL 处理且不透出原始消息', () => {
        const payload = toApiErrorPayload(new Error('database password leaked'));

        expect(payload.statusCode).toBe(500);
        expect(payload.data.error.code).toBe('INTERNAL');
        expect(payload.data.error.message).toBe('服务器内部错误');
    });
});

describe('getApiErrorCode', () => {
    it('读取新错误信封里的 code', () => {
        expect(getApiErrorCode({ data: { error: { code: 'NOT_FOUND' } } })).toBe('NOT_FOUND');
    });

    it('没有错误信封时返回 null', () => {
        expect(getApiErrorCode({ message: '网络异常' })).toBeNull();
        expect(getApiErrorCode(null)).toBeNull();
    });
});
