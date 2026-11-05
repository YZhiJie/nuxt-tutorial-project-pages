import { describe, expect, it } from 'vitest';
import { setup } from '@nuxt/test-utils/e2e';
import { ofetch } from 'ofetch';
import type { AdminStats } from '../../shared/types/admin';
import type { Note } from '../../shared/types/note';

// 真实启动 Nuxt 服务端，从 HTTP 层验证 notes / admin 的契约与错误信封。
// 覆盖：正常路径、校验失败、未授权、资源不存在。
// build 必须为 true：@nuxt/test-utils 只有在 build 阶段才初始化 ctx.nuxt，
// 否则 startServer 拿不到 Nuxt 配置；生产模式启动产物服务，更接近真实部署。
await setup({
    server: true,
    build: true,
    dev: false,
    port: 3201,
    setupTimeout: 240_000,
});

interface RawResponse {
    status: number;
    _data: unknown;
}

interface ErrorEnvelope {
    data?: {
        error?: {
            code?: string;
            details?: Record<string, string>;
        };
    };
}

const BASE_URL = 'http://127.0.0.1:3201';
const request = (path: string, options: Record<string, unknown> = {}) =>
    ofetch.raw(`${BASE_URL}${path}`, {
        ignoreResponseError: true,
        ...options,
    }) as unknown as Promise<RawResponse>;

const errorCode = (response: RawResponse): string | undefined =>
    (response._data as ErrorEnvelope | undefined)?.data?.error?.code;

const errorDetails = (response: RawResponse): Record<string, string> | undefined =>
    (response._data as ErrorEnvelope | undefined)?.data?.error?.details;

describe('notes API 集成', () => {
    it('列表返回数组（正常路径）', async () => {
        const response = await request('/api/notes');
        expect(response.status).toBe(200);
        expect(Array.isArray(response._data)).toBe(true);
    });

    it('创建后可读、可删（正常路径）', async () => {
        const title = `集成测试笔记-${Date.now()}`;
        const created = await request('/api/notes', {
            method: 'POST',
            body: { title, content: '来自集成测试的正文' },
        });
        expect(created.status).toBe(200);
        const note = created._data as Note;
        expect(note.title).toBe(title);

        const detail = await request(`/api/notes/${note.id}`);
        expect(detail.status).toBe(200);
        expect((detail._data as Note).id).toBe(note.id);

        const removed = await request(`/api/notes/${note.id}`, { method: 'DELETE' });
        expect(removed.status).toBe(200);
        expect(removed._data).toEqual({ ok: true });
    });

    it('空标题返回 400 VALIDATION_FAILED（校验失败）', async () => {
        const response = await request('/api/notes', {
            method: 'POST',
            body: { title: '   ' },
        });
        expect(response.status).toBe(400);
        expect(errorCode(response)).toBe('VALIDATION_FAILED');
        expect(errorDetails(response)?.title).toBe('标题不能为空');
    });

    it('非法 id 返回 400 VALIDATION_FAILED（校验失败）', async () => {
        const response = await request('/api/notes/abc');
        expect(response.status).toBe(400);
        expect(errorCode(response)).toBe('VALIDATION_FAILED');
    });

    it('不存在的笔记返回 404 NOT_FOUND（资源不存在）', async () => {
        const detail = await request('/api/notes/999999');
        expect(detail.status).toBe(404);
        expect(errorCode(detail)).toBe('NOT_FOUND');

        const removed = await request('/api/notes/999999', { method: 'DELETE' });
        expect(removed.status).toBe(404);
        expect(errorCode(removed)).toBe('NOT_FOUND');
    });
});

describe('admin API 集成', () => {
    it('未登录返回 401 UNAUTHORIZED（未授权）', async () => {
        const response = await request('/api/admin/stats');
        expect(response.status).toBe(401);
        expect(errorCode(response)).toBe('UNAUTHORIZED');
    });

    it('带会话 cookie 返回统计（正常路径）', async () => {
        const response = await request('/api/admin/stats', {
            headers: { cookie: 'session=demo-token' },
        });
        expect(response.status).toBe(200);
        const stats = response._data as AdminStats;
        expect(typeof stats.totalNotes).toBe('number');
        expect(typeof stats.totalTags).toBe('number');
    });
});
