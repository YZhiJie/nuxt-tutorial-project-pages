import type { FullstackItem, FullstackItemInput } from '#shared/types/fullstack-item';

// 创建条目：POST /api/fullstack/items
export default defineEventHandler(async (event) => {
    const body = await readBody<Partial<FullstackItemInput>>(event);

    // 运行时校验：类型不能代替校验，服务端必须自己兜底
    const title = String(body?.title ?? '').trim();
    if (!title) {
        throw createError({ statusCode: 400, message: '标题不能为空' });
    }
    if (title.length > 80) {
        throw createError({ statusCode: 400, message: '标题不能超过 80 个字符' });
    }

    const item: FullstackItem = await createItem({
        title,
        note: String(body?.note ?? '').trim(),
        done: Boolean(body?.done),
    });

    setResponseStatus(event, 201);
    return item;
});
