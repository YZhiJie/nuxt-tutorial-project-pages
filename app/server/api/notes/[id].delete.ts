import { noteService } from '../../services/notes';

// 删除笔记：不存在时返回 NOT_FOUND，而不是静默成功
export default defineEventHandler(async (event) => {
    const id = Number(getRouterParam(event, 'id'));
    try {
        await noteService.remove(id);
        return { ok: true };
    } catch (error) {
        throw toApiError(event, error);
    }
});
