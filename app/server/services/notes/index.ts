import { createNoteService } from './note-service';
import { noteRepository } from '../../repositories/notes/note-repository';

export { createNoteService, NoteValidationError, NoteNotFoundError } from './note-service';
export type { NoteRepository, NoteService } from './note-service';

// 生产环境用真实 repository；测试用 createNoteService(fakeRepository)
export const noteService = createNoteService(noteRepository);
