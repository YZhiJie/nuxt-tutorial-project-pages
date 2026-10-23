import { describe, expect, it } from 'vitest';
import { formatDate } from '../app/utils/format';

describe('formatDate', () => {
    it('格式化常规日期', () => {
        expect(formatDate('2026-10-18T12:00:00')).toBe('2026 年 10 月 18 日');
    });

    it('格式化个位数月日', () => {
        expect(formatDate('2026-01-05T12:00:00')).toBe('2026 年 1 月 5 日');
    });

    it('非法输入兜底返回原字符串', () => {
        expect(formatDate('不是日期')).toBe('不是日期');
    });
});
