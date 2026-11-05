import { describe, expect, it } from 'vitest';
import { createNoteService, NoteNotFoundError, NoteValidationError } from '../../../server/services/notes/note-service';
import type { Note, NoteInput } from '../../../shared/types/note';

function createFakeRepository(seed: Note[] = []) {
    const notes = [...seed];
    const calls = { create: 0, remove: [] as number[] };

    return {
        calls,
        async list(): Promise<Note[]> {
            return notes;
        },
        async get(id: number): Promise<Note | undefined> {
            return notes.find((note) => note.id === id);
        },
        async create(input: NoteInput): Promise<Note> {
            calls.create += 1;
            const note: Note = {
                id: notes.reduce((max, item) => Math.max(max, item.id), 0) + 1,
                title: input.title,
                excerpt: input.excerpt ?? input.content.slice(0, 60),
                content: input.content,
                tags: input.tags ?? [],
                createdAt: '2026-11-04T00:00:00.000Z',
            };
            notes.push(note);
            return note;
        },
        async remove(id: number): Promise<void> {
            calls.remove.push(id);
            const index = notes.findIndex((note) => note.id === id);
            if (index >= 0) notes.splice(index, 1);
        },
    };
}

const seed: Note[] = [
    {
        id: 1,
        title: 'Nuxt SSR',
        excerpt: '服务端渲染',
        content: 'content',
        tags: ['nuxt'],
        createdAt: '2026-10-01T09:00:00.000Z',
    },
];

describe('noteService', () => {
    it('创建时使用契约归一化后的值', async () => {
        const repository = createFakeRepository(seed);
        const service = createNoteService(repository);
        const note = await service.create({ title: '  新笔记  ', tags: [' ssr '] });

        expect(note.title).toBe('新笔记');
        expect(note.content).toBe('');
        expect(note.tags).toEqual(['ssr']);
        expect(repository.calls.create).toBe(1);
    });

    it('创建时标题为空抛出 VALIDATION_FAILED', async () => {
        const service = createNoteService(createFakeRepository(seed));
        await expect(service.create({ content: '正文' })).rejects.toMatchObject({
            code: 'VALIDATION_FAILED',
            details: { title: '标题不能为空' },
        });
    });

    it('非法 id 抛出 VALIDATION_FAILED', async () => {
        const service = createNoteService(createFakeRepository(seed));
        await expect(service.get(Number('abc'))).rejects.toBeInstanceOf(NoteValidationError);
        await expect(service.get(0)).rejects.toMatchObject({ details: { id: 'id 必须是正整数' } });
    });

    it('查询不存在的笔记抛出 NOT_FOUND', async () => {
        const service = createNoteService(createFakeRepository(seed));
        await expect(service.get(99)).rejects.toBeInstanceOf(NoteNotFoundError);
    });

    it('删除不存在的笔记不调用 repository.remove', async () => {
        const repository = createFakeRepository(seed);
        const service = createNoteService(repository);
        await expect(service.remove(99)).rejects.toBeInstanceOf(NoteNotFoundError);
        expect(repository.calls.remove).toEqual([]);
    });

    it('列表按标题/摘要过滤且大小写不敏感', async () => {
        const service = createNoteService(createFakeRepository(seed));
        expect(await service.list('ssr')).toHaveLength(1);
        expect(await service.list('SSR')).toHaveLength(1);
        expect(await service.list('不存在')).toHaveLength(0);
    });
});
