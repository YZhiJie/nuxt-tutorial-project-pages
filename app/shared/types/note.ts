// 笔记实体：前后端共享类型
export interface Note {
    id: number;
    title: string;
    excerpt: string;
    content: string;
    tags: string[];
    createdAt: string;
}

// 创建笔记的入参：摘要与标签可选
export type NoteInput = Pick<Note, 'title' | 'content'> & {
    excerpt?: string;
    tags?: string[];
};
