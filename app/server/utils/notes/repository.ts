import type { Note, NoteInput } from '#shared/types/note';

// 存储 key：挂在 nuxt.config.ts 配置的 data 命名空间（fs 驱动，.data/kv）
const KEY = 'notes';

// 种子数据：首次访问时写入
const seedNotes: Note[] = [
    {
        id: 1,
        title: 'Nuxt 4 快速上手',
        excerpt: '从创建项目到第一个页面，十分钟跑通 Nuxt 4 开发流程。',
        content: '本文介绍 Nuxt 4 的安装、目录结构与第一个页面的创建过程，帮助你在十分钟内跑通开发流程。',
        tags: ['nuxt', '入门'],
        createdAt: '2026-10-01T09:00:00.000Z',
    },
    {
        id: 2,
        title: 'useFetch 与服务端渲染',
        excerpt: '理解 SSR 下数据拉取的时序、缓存与状态同构。',
        content: 'useFetch 是 Nuxt 中最常用的数据请求组合式函数，它在服务端渲染时会自动完成状态同构……',
        tags: ['nuxt', 'ssr'],
        createdAt: '2026-10-05T09:00:00.000Z',
    },
    {
        id: 3,
        title: 'Pinia 状态管理实战',
        excerpt: 'Options 与 Setup 两种风格的 store 写法对比。',
        content: 'Pinia 是 Vue 官方推荐的状态管理库，在 Nuxt 中通过 @pinia/nuxt 模块一键集成……',
        tags: ['pinia', '状态管理'],
        createdAt: '2026-10-10T09:00:00.000Z',
    },
];

// 读取全部笔记（首次访问写入种子数据）
async function readAll(): Promise<Note[]> {
    const storage = useStorage<{ notes: Note[] }>('data');
    const stored = await storage.getItem(KEY);
    if (!stored) {
        await storage.setItem(KEY, seedNotes);
        return seedNotes;
    }
    return stored;
}

// 写回全部笔记
async function writeAll(notes: Note[]): Promise<void> {
    const storage = useStorage<{ notes: Note[] }>('data');
    await storage.setItem(KEY, notes);
}

// 列出全部笔记（按创建时间倒序）
export async function listNotes(): Promise<Note[]> {
    const notes = await readAll();
    return [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// 按 id 查找笔记
export async function getNote(id: number): Promise<Note | undefined> {
    const notes = await readAll();
    return notes.find((note) => note.id === id);
}

// 创建笔记（id 自增，缺省摘要取正文前 60 字）
export async function createNote(input: NoteInput): Promise<Note> {
    const notes = await readAll();
    const note: Note = {
        id: notes.reduce((max, item) => Math.max(max, item.id), 0) + 1,
        title: input.title,
        excerpt: input.excerpt ?? input.content.slice(0, 60),
        content: input.content,
        tags: input.tags ?? [],
        createdAt: new Date().toISOString(),
    };
    await writeAll([...notes, note]);
    return note;
}

// 删除笔记
export async function removeNote(id: number): Promise<void> {
    const notes = await readAll();
    await writeAll(notes.filter((note) => note.id !== id));
}
