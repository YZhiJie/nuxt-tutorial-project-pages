import { describe, expect, it } from 'vitest';
import { createAdminStatsService } from '../../../server/services/admin/admin-stats-service';
import type { Note } from '../../../shared/types/note';

function createRepository(notes: Note[]) {
    return {
        listNotes: async () => notes,
    };
}

const NOTES: Note[] = [
    {
        id: 1,
        title: 'Nitro 路由',
        excerpt: '文件路由',
        content: '内容',
        tags: ['nitro', 'routing'],
        createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
        id: 2,
        title: 'Vue 组件',
        excerpt: '组件通信',
        content: '内容',
        tags: ['vue', 'nitro'],
        createdAt: '2026-02-01T00:00:00.000Z',
    },
];

describe('createAdminStatsService', () => {
    it('通过 repository 汇总笔记数、标签数与最新时间', async () => {
        const service = createAdminStatsService(createRepository(NOTES));

        await expect(service.getStats()).resolves.toEqual({
            totalNotes: 2,
            totalTags: 3,
            latestNoteAt: '2026-02-01T00:00:00.000Z',
        });
    });

    it('空数据返回零值与 null 最新时间', async () => {
        const service = createAdminStatsService(createRepository([]));

        await expect(service.getStats()).resolves.toEqual({
            totalNotes: 0,
            totalTags: 0,
            latestNoteAt: null,
        });
    });

    it('repository 异常向上抛出，交由 handler 映射为 INTERNAL', async () => {
        const service = createAdminStatsService({
            listNotes: async () => {
                throw new Error('storage unavailable');
            },
        });

        await expect(service.getStats()).rejects.toThrow('storage unavailable');
    });
});
