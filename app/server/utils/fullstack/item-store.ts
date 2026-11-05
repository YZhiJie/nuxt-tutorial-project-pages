import type { FullstackItem } from '#shared/types/fullstack-item';

// KV key：挂在 nuxt.config.ts 的 data 命名空间（fs 驱动，dev 下落盘到 .data/kv）
const KEY = 'fullstack-items';

// 种子数据：首次访问写入，保证页面一打开就有内容
const seedItems: FullstackItem[] = [
    {
        id: 1,
        title: 'Nitro 存储层清单',
        note: 'useStorage 的 key 设计、命名空间与读写边界。',
        done: true,
        createdAt: '2026-10-01T08:00:00.000Z',
    },
    {
        id: 2,
        title: 'REST 状态码约定',
        note: '201 / 400 / 404 / 409 各自的责任边界。',
        done: false,
        createdAt: '2026-10-06T08:00:00.000Z',
    },
];

async function readAll(): Promise<FullstackItem[]> {
    const storage = useStorage<FullstackItem[]>('data');
    const stored = await storage.getItem(KEY);
    if (!stored) {
        await storage.setItem(KEY, [...seedItems]);
        return [...seedItems];
    }
    return stored;
}

async function writeAll(items: FullstackItem[]): Promise<void> {
    const storage = useStorage<FullstackItem[]>('data');
    await storage.setItem(KEY, items);
}

// 列出全部条目（按创建时间倒序）
export async function listItems(): Promise<FullstackItem[]> {
    const items = await readAll();
    return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// 创建条目：id 自增，note / done 缺省补全
export async function createItem(input: {
    title: string;
    note?: string;
    done?: boolean;
}): Promise<FullstackItem> {
    const items = await readAll();
    const item: FullstackItem = {
        id: items.reduce((max, current) => Math.max(max, current.id), 0) + 1,
        title: input.title,
        note: input.note ?? '',
        done: input.done ?? false,
        createdAt: new Date().toISOString(),
    };
    await writeAll([...items, item]);
    return item;
}

// 删除条目：返回是否真的删掉了，供路由层区分 404
export async function removeItem(id: number): Promise<boolean> {
    const items = await readAll();
    const next = items.filter((item) => item.id !== id);
    if (next.length === items.length) return false;
    await writeAll(next);
    return true;
}
