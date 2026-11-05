import { describe, expect, it } from 'vitest';
import { summarizeNotes } from '../../../shared/utils/notes-stats';
import type { Note } from '../../../shared/types/note';

const notes: Note[] = [
    {
        id: 1,
        title: 'A',
        excerpt: 'a',
        content: 'a',
        tags: ['nuxt', 'ssr'],
        createdAt: '2026-10-01T09:00:00.000Z',
    },
    {
        id: 2,
        title: 'B',
        excerpt: 'b',
        content: 'b',
        tags: ['nuxt', 'pinia'],
        createdAt: '2026-10-10T09:00:00.000Z',
    },
];

describe('summarizeNotes', () => {
    it('汇总笔记数、标签数与最新时间', () => {
        expect(summarizeNotes(notes)).toEqual({
            totalNotes: 2,
            totalTags: 3,
            latestNoteAt: '2026-10-10T09:00:00.000Z',
        });
    });

    it('空列表返回零值与 null', () => {
        expect(summarizeNotes([])).toEqual({
            totalNotes: 0,
            totalTags: 0,
            latestNoteAt: null,
        });
    });
});
