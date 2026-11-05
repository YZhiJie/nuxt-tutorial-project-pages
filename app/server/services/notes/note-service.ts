import type { Note, NoteInput } from '../../../shared/types/note';
import { API_ERROR_CODES, type ApiErrorCode } from '../../../shared/contracts/api';
import { parseNoteCreateInput } from '../../../shared/contracts/notes';

// repository 只负责存取；service 负责校验、编排与抛业务错误
export interface NoteRepository {
    list(): Promise<Note[]>;
    get(id: number): Promise<Note | undefined>;
    create(input: NoteInput): Promise<Note>;
    remove(id: number): Promise<void>;
}

interface DomainErrorShape {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, string>;
}

export class NoteValidationError extends Error implements DomainErrorShape {
    readonly code = API_ERROR_CODES.VALIDATION_FAILED;
    readonly details: Record<string, string>;

    constructor(details: Record<string, string>, message = '笔记参数校验失败') {
        super(message);
        this.name = 'NoteValidationError';
        this.details = details;
    }
}

export class NoteNotFoundError extends Error implements DomainErrorShape {
    readonly code = API_ERROR_CODES.NOT_FOUND;
    readonly noteId: number;

    constructor(noteId: number) {
        super(`笔记 ${noteId} 不存在`);
        this.name = 'NoteNotFoundError';
        this.noteId = noteId;
    }
}

function assertId(id: number): void {
    if (!Number.isInteger(id) || id <= 0) {
        throw new NoteValidationError({ id: 'id 必须是正整数' });
    }
}

export function createNoteService(repository: NoteRepository) {
    return {
        async list(keyword = ''): Promise<Note[]> {
            const notes = await repository.list();
            const normalized = keyword.trim().toLowerCase();
            if (!normalized) return notes;
            return notes.filter(
                (note) =>
                    note.title.toLowerCase().includes(normalized) ||
                    note.excerpt.toLowerCase().includes(normalized),
            );
        },

        async get(id: number): Promise<Note> {
            assertId(id);
            const note = await repository.get(id);
            if (!note) throw new NoteNotFoundError(id);
            return note;
        },

        async create(input: unknown): Promise<Note> {
            const parsed = parseNoteCreateInput(input);
            if (!parsed.ok) throw new NoteValidationError(parsed.details);
            return repository.create(parsed.value);
        },

        async remove(id: number): Promise<void> {
            assertId(id);
            const note = await repository.get(id);
            if (!note) throw new NoteNotFoundError(id);
            await repository.remove(id);
        },
    };
}

export type NoteService = ReturnType<typeof createNoteService>;
