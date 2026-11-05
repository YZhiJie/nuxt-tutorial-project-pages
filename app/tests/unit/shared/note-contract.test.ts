import { describe, expect, it } from 'vitest';
import { parseNoteCreateInput } from '../../../shared/contracts/notes';

describe('parseNoteCreateInput', () => {
    it('拒绝非对象请求体', () => {
        expect(parseNoteCreateInput(null)).toEqual({
            ok: false,
            details: { body: '请求体必须是 JSON 对象' },
        });
        expect(parseNoteCreateInput([1, 2])).toEqual({
            ok: false,
            details: { body: '请求体必须是 JSON 对象' },
        });
    });

    it('标题缺失时返回字段级错误', () => {
        const result = parseNoteCreateInput({ content: '正文' });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.details.title).toBe('标题不能为空');
    });

    it('归一化标题、默认正文、清理标签', () => {
        const result = parseNoteCreateInput({
            title: '  Nuxt 笔记  ',
            tags: [' nuxt ', '', 123],
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toEqual({
                title: 'Nuxt 笔记',
                content: '',
                excerpt: undefined,
                tags: ['nuxt'],
            });
        }
    });

    it('字段类型错误会被收集', () => {
        const result = parseNoteCreateInput({
            title: '标题',
            content: 42,
            excerpt: false,
            tags: 'nuxt',
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(Object.keys(result.details).sort()).toEqual(['content', 'excerpt', 'tags']);
        }
    });
});
