import { describe, expect, it } from 'vitest';
import { summarizeNotes } from '../shared/utils/notes-stats';
import type { Note } from '../shared/types/note';

function makeNote(partial: Partial<Note> & Pick<Note, 'id' | 'createdAt'>): Note {
    return {
        title: `笔记 ${partial.id}`,
        excerpt: '',
        content: '',
        tags: [],
        ...partial,
    };
}

const notes: Note[] = [
    makeNote({ id: 1, tags: ['nuxt', 'ssr'], createdAt: '2026-10-01T09:00:00.000Z' }),
    makeNote({ id: 2, tags: ['nuxt', 'pinia'], createdAt: '2026-10-10T09:00:00.000Z' }),
];

describe('summarizeNotes', () => {
    it('汇总笔记数量与最新创建时间', () => {
        expect(summarizeNotes(notes)).toEqual({
            totalNotes: 2,
            totalTags: 3,
            latestNoteAt: '2026-10-10T09:00:00.000Z',
        });
    });

    it('标签跨笔记去重，重复标签不重复计数', () => {
        const result = summarizeNotes([
            makeNote({ id: 3, tags: ['nuxt', 'nuxt'], createdAt: '2026-10-02T09:00:00.000Z' }),
            makeNote({ id: 4, tags: ['nuxt', 'testing'], createdAt: '2026-10-03T09:00:00.000Z' }),
        ]);
        expect(result.totalTags).toBe(2);
    });

    it('空列表返回零值与 null，而不是抛错', () => {
        expect(summarizeNotes([])).toEqual({
            totalNotes: 0,
            totalTags: 0,
            latestNoteAt: null,
        });
    });

    it('不修改入参数组（纯函数）', () => {
        const input = [...notes];
        summarizeNotes(input);
        expect(input).toHaveLength(2);
        expect(input[0]?.id).toBe(1);
    });
});
