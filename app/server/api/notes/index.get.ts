// 笔记列表：支持 ?q= 按标题/摘要模糊搜索
export default defineEventHandler(async (event) => {
    const { q } = getQuery(event);
    const keyword = String(q ?? '').trim().toLowerCase();
    const notes = await listNotes();
    if (!keyword) {
        return notes;
    }
    return notes.filter(
        (note) =>
            note.title.toLowerCase().includes(keyword) ||
            note.excerpt.toLowerCase().includes(keyword),
    );
});
