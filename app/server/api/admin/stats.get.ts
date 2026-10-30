import type { AdminStats } from '#shared/types/admin';
import { summarizeNotes } from '#shared/utils/notes-stats';

// 管理后台概览：受 server/middleware/auth.ts 保护
export default defineEventHandler(async (): Promise<AdminStats> => {
    const notes = await listNotes();
    return summarizeNotes(notes);
});
