import type { NoteRepository } from '../../services/notes/note-service';
import {
    createNote,
    getNote,
    listNotes,
    removeNote,
} from '../../utils/notes/repository';

/**
 * repository 适配层：把现有的存储函数收敛成 NoteRepository 接口。
 * service 只依赖接口，测试时可以直接注入内存假仓库。
 */
export const noteRepository: NoteRepository = {
    list: listNotes,
    get: getNote,
    create: createNote,
    remove: removeNote,
};
