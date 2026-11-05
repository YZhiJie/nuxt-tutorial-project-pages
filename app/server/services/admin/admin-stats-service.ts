import type { Note } from '../../../shared/types/note';
import type { AdminStatsResponse } from '../../../shared/contracts/admin';
import { toAdminStatsResponse } from '../../../shared/contracts/admin';
import { summarizeNotes } from '../../../shared/utils/notes-stats';

// repository 只提供原始数据；service 负责编排与响应契约收敛
export interface AdminStatsRepository {
    listNotes(): Promise<Note[]>;
}

export function createAdminStatsService(repository: AdminStatsRepository) {
    return {
        async getStats(): Promise<AdminStatsResponse> {
            const notes = await repository.listNotes();
            return toAdminStatsResponse(summarizeNotes(notes));
        },
    };
}

export type AdminStatsService = ReturnType<typeof createAdminStatsService>;
