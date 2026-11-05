import { noteService } from '../../services/notes';

// 创建笔记：契约校验交给 service，错误统一走 toApiError
export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    try {
        return await noteService.create(body);
    } catch (error) {
        throw toApiError(event, error);
    }
});
