import type { NoteInput } from '#shared/types/note';

// 创建笔记：标题必填
export default defineEventHandler(async (event) => {
    const body = await readBody<NoteInput>(event);
    if (!body?.title?.trim()) {
        throw createError({ statusCode: 400, statusMessage: '标题不能为空' });
    }
    const note = await createNote({
        ...body,
        title: body.title.trim(),
        content: body.content ?? '',
    });
    return note;
});
