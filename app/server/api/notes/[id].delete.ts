// 删除笔记
export default defineEventHandler(async (event) => {
    const id = Number(getRouterParam(event, 'id'));
    await removeNote(id);
    return { ok: true };
});
