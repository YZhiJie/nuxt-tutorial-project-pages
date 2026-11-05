// 删除条目：DELETE /api/fullstack/items/:id
export default defineEventHandler(async (event) => {
    const raw = getRouterParam(event, 'id');
    const id = Number(raw);

    if (!Number.isInteger(id) || id <= 0) {
        throw createError({ statusCode: 400, message: '非法的条目 id' });
    }

    const removed = await removeItem(id);
    if (!removed) {
        throw createError({ statusCode: 404, message: '条目不存在' });
    }

    return { ok: true, id };
});
