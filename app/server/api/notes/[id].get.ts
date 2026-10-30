// 笔记详情：按 id 查询，不存在则 404
export default defineEventHandler(async (event) => {
    const id = Number(getRouterParam(event, 'id'));
    const note = await getNote(id);
    if (!note) {
        throw createError({ statusCode: 404, message: '笔记不存在' });
    }
    return note;
});
