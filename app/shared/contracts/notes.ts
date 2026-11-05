import type { NoteInput } from '../types/note';

export type NoteCreateParseResult =
    | { ok: true; value: NoteInput }
    | { ok: false; details: Record<string, string> };

/**
 * 创建笔记的入参契约：把「请求体可能是任意 JSON」收敛成 NoteInput。
 * 只做结构校验与归一化，不碰存储，因此可以被单测直接覆盖。
 */
export function parseNoteCreateInput(input: unknown): NoteCreateParseResult {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        return { ok: false, details: { body: '请求体必须是 JSON 对象' } };
    }

    const raw = input as Record<string, unknown>;
    const details: Record<string, string> = {};

    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    if (!title) {
        details.title = '标题不能为空';
    }

    if (raw.content !== undefined && typeof raw.content !== 'string') {
        details.content = '正文必须是字符串';
    }

    let excerpt: string | undefined;
    if (raw.excerpt !== undefined) {
        if (typeof raw.excerpt !== 'string') {
            details.excerpt = '摘要必须是字符串';
        } else {
            excerpt = raw.excerpt.trim() || undefined;
        }
    }

    let tags: string[] | undefined;
    if (raw.tags !== undefined) {
        if (!Array.isArray(raw.tags)) {
            details.tags = '标签必须是字符串数组';
        } else {
            tags = raw.tags
                .filter((tag): tag is string => typeof tag === 'string')
                .map((tag) => tag.trim())
                .filter(Boolean);
        }
    }

    if (Object.keys(details).length > 0) {
        return { ok: false, details };
    }

    return {
        ok: true,
        value: {
            title,
            content: typeof raw.content === 'string' ? raw.content : '',
            excerpt,
            tags,
        },
    };
}
