// 条目列表：GET /api/fullstack/items
export default defineEventHandler(async () => {
    return await listItems();
});
