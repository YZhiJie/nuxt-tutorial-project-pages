// 管理后台概览数据：前后端共享
export interface AdminStats {
    totalNotes: number;
    totalTags: number;
    latestNoteAt: string | null;
}
