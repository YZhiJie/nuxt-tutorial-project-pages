import { noteService } from '../../services/notes';

// 笔记列表：支持 ?q= 按标题/摘要模糊搜索
export default defineEventHandler(async (event) => {
    const { q } = getQuery(event);
    return noteService.list(String(q ?? ''));
});
