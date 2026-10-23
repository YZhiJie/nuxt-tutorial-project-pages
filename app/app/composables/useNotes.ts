import type { Note } from '#shared/types/note';

// 笔记相关请求封装
export function useNotes() {
    // 笔记列表（在 setup 中调用）
    const fetchList = () => useFetch<Note[]>('/api/notes');
    // 笔记详情
    const fetchNote = (id: string | number) => useFetch<Note>(`/api/notes/${id}`);

    return { fetchList, fetchNote };
}
