// KV 存储 CRUD 演示实体：前后端共享
export interface FullstackItem {
    id: number;
    title: string;
    note: string;
    done: boolean;
    createdAt: string;
}

// 创建入参：只有标题必填
export interface FullstackItemInput {
    title: string;
    note?: string;
    done?: boolean;
}
