import { describe, expect, it } from 'vitest';
import { getApiErrorMessage } from '../../../app/utils/api-error';

describe('getApiErrorMessage', () => {
    it('优先使用服务端 data.message', () => {
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
