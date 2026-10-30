import type { Note } from '#shared/types/note';
import type { AdminStats } from '#shared/types/admin';

// 纯函数：根据笔记列表汇总后台概览数据，便于单测
export function summarizeNotes(notes: Note[]): AdminStats {
    const tags = new Set(notes.flatMap((note) => note.tags));
    const latestNoteAt = notes.reduce<string | null>(
        (latest, note) => (!latest || note.createdAt > latest ? note.createdAt : latest),
        null,
    );

    return {
        totalNotes: notes.length,
        totalTags: tags.size,
        latestNoteAt,
    };
}
