import { noteService } from '../../services/notes';

// 笔记详情：id 非法或不存在时返回统一的 4xx 错误码
export default defineEventHandler(async (event) => {
    const id = Number(getRouterParam(event, 'id'));
    try {
        return await noteService.get(id);
    } catch (error) {
        throw toApiError(event, error);
    }
});
