<script setup lang="ts">
import type { Note, NoteInput } from '#shared/types/note';

definePageMeta({ layout: 'docs' });

const { data: notes, status, refresh } = await useFetch<Note[]>('/api/notes', {
    key: 'server-api-notes',
});

const form = reactive<NoteInput>({ title: '', content: '' });
const submitting = ref(false);
const notice = ref('');
const errorText = ref('');

async function create() {
    errorText.value = '';
    notice.value = '';

    if (!form.title.trim()) {
        errorText.value = '标题不能为空';
        return;
    }

    submitting.value = true;
    try {
        const created = await $fetch<Note>('/api/notes', {
            method: 'POST',
            body: { title: form.title, content: form.content },
        });
        notice.value = `已创建 #${created.id}：${created.title}`;
        form.title = '';
        form.content = '';
        await refresh();
    } catch (error) {
        errorText.value = getApiErrorMessage(error);
    } finally {
        submitting.value = false;
    }
}

const SERVER_TREE = `server/
├── api/
│   ├── hello.get.ts            → GET    /api/hello
│   └── notes/
│       ├── index.get.ts        → GET    /api/notes
│       ├── index.post.ts       → POST   /api/notes
│       ├── [id].get.ts         → GET    /api/notes/:id
│       └── [id].delete.ts      → DELETE /api/notes/:id
├── middleware/
└── utils/
    └── notes/repository.ts     → 自动导入的 listNotes / createNote`;

const HANDLER_CODE = `// server/api/notes/index.get.ts
export default defineEventHandler(async (event) => {
    const { q } = getQuery(event);
    const keyword = String(q ?? '').trim().toLowerCase();
    const notes = await listNotes(); // server/utils 自动导入

    if (!keyword) return notes;
    return notes.filter(
        (note) =>
            note.title.toLowerCase().includes(keyword) ||
            note.excerpt.toLowerCase().includes(keyword),
    );
});

// server/api/notes/index.post.ts
export default defineEventHandler(async (event) => {
    const body = await readBody<NoteInput>(event);
    if (!body?.title?.trim()) {
        throw createError({ statusCode: 400, message: '标题不能为空' });
    }
    return createNote({
        ...body,
        title: body.title.trim(),
        content: body.content ?? '',
    });
});`;

const SHARED_CODE = `// shared/types/note.ts —— 前后端唯一事实来源
export interface Note {
    id: number;
    title: string;
    excerpt: string;
    content: string;
    tags: string[];
    createdAt: string;
}

export type NoteInput = Pick<Note, 'title' | 'content'> & {
    excerpt?: string;
    tags?: string[];
};

// 页面、composable、Nitro handler 都从同一路径导入
import type { Note, NoteInput } from '#shared/types/note';`;

const REQUEST_CODE = `// GET 列表（带查询参数）
const notes = await $fetch<Note[]>('/api/notes', { query: { q: 'nuxt' } });

// POST 创建：类型由 NoteInput 约束
const created = await $fetch<Note>('/api/notes', {
    method: 'POST',
    body: {
        title: '新的笔记',
        content: '正文……',
    } satisfies NoteInput,
});

// 写成功后刷新同一份列表缓存
await refreshNuxtData('server-api-notes');`;

const ERROR_CODE = `// 服务端：错误码与消息在 createError 中一次定义
throw createError({ statusCode: 400, message: '标题不能为空' });
throw createError({ statusCode: 404, message: '笔记不存在' });

// 客户端：$fetch 抛出的错误统一归一为可展示文案
try {
    await $fetch('/api/notes', { method: 'POST', body });
} catch (error) {
    errorText.value = getApiErrorMessage(error);
} `;
</script>

<template>
    <DocPage
        title="服务端 API 与类型契约"
        description="Nitro 用文件路径定义接口，用文件名后缀定义方法。真正让前后端协作成本下降的，是共享类型与统一错误约定。"
        :tags="['Nitro', '文件路由', 'getQuery', 'readBody', 'createError', '#shared']"
    >
        <DocSection id="routing" title="Nitro 文件路由与方法后缀" kicker="01 · ROUTING">
            <p class="body-text">
                <code>server/api/</code> 下的文件路径就是 URL，方法由文件名后缀决定：
                <code>.get.ts</code>、<code>.post.ts</code>、<code>.delete.ts</code>。
                目录下的 <code>index.*.ts</code> 对应目录根路径，<code>[id]</code> 是动态参数。
            </p>
            <CodeBlock :code="SERVER_TREE" lang="text" title="接口目录 → URL" />
            <Callout type="tip" title="一个文件只处理一个方法">
                同一路径的多个方法拆成多个文件（<code>index.get.ts</code> 与
                <code>index.post.ts</code>），职责清晰、类型独立，也便于按方法做限流与鉴权。
            </Callout>
        </DocSection>

        <DocSection id="params" title="参数读取与错误抛出" kicker="02 · PARAMS">
            <p class="body-text">
                查询参数从 <code>getQuery(event)</code> 读，请求体从
                <code>readBody(event)</code> 读。两者都需要二次校验，
                错误用 <code>createError</code> 抛给客户端，并保留正确状态码。
            </p>
            <CodeBlock :code="HANDLER_CODE" lang="ts" title="GET 与 POST 处理器" />
            <CodeBlock :code="ERROR_CODE" lang="ts" title="错误码约定" />
        </DocSection>

        <DocSection id="shared" title="共享类型契约" kicker="03 · TYPES">
            <p class="body-text">
                <code>#shared</code> 目录同时被前端与服务端引用。实体与入参类型只定义一次，
                前端拿到的 <code>Note</code> 与服务端返回的结构不可能漂移。
            </p>
            <CodeBlock :code="SHARED_CODE" lang="ts" title="shared/types/note.ts" />
            <Callout type="warn" title="共享类型 ≠ 运行时校验">
                TypeScript 在编译后消失。服务端仍然需要 <code>readBody</code> 后的显式校验，
                不能因为“有类型”就跳过运行时检查。
            </Callout>
        </DocSection>

        <DocSection id="demo" title="触发一次真实请求" kicker="04 · LIVE API">
            <p class="body-text">
                下面直接向现有的 <code>POST /api/notes</code> 提交数据：成功后用
                <code>$fetch</code> 拿到新实体，再刷新使用
                <code>server-api-notes</code> key 的列表缓存。
            </p>
            <DemoCard title="创建笔记并刷新列表" desc="表单 → POST /api/notes → refresh() 同一 key。" badge="API">
                <form class="api-form" @submit.prevent="create">
                    <input
                        v-model="form.title"
                        class="input"
                        type="text"
                        placeholder="标题（必填），如：Nitro 文件路由"
                    />
                    <textarea
                        v-model="form.content"
                        class="textarea"
                        rows="3"
                        placeholder="正文（可选）"
                    />
                    <div class="form-row">
                        <button type="submit" class="btn" :disabled="submitting">
                            {{ submitting ? '提交中……' : 'POST /api/notes' }}
                        </button>
                        <span class="form-hint">当前列表数量：{{ notes?.length ?? 0 }}</span>
                    </div>
                </form>

                <p v-if="errorText" class="demo-error">{{ errorText }}</p>
                <p v-else-if="notice" class="demo-notice">{{ notice }}</p>

                <ul v-if="notes?.length" class="note-list">
                    <li v-for="note in notes.slice(0, 4)" :key="note.id" class="note-item">
                        <span class="note-id mono">#{{ note.id }}</span>
                        <span class="note-title">{{ note.title }}</span>
                        <span class="note-status">{{ status === 'pending' ? '刷新中' : '已同步' }}</span>
                    </li>
                </ul>
            </DemoCard>
        </DocSection>

        <DocSection id="request" title="请求示例与刷新策略" kicker="05 · REQUEST">
            <p class="body-text">
                查询用 <code>useFetch</code> / <code>refreshNuxtData</code>，写入用
                <code>$fetch</code>。写操作成功后只刷新相关 key，避免整页重载。
            </p>
            <CodeBlock :code="REQUEST_CODE" lang="ts" title="读写分离的请求方式" />
        </DocSection>
    </DocPage>
</template>

<style scoped>
.body-text {
    margin: 0 0 12px;
    font-size: 14px;
    line-height: 1.8;
    color: var(--text-muted);
}

.api-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.form-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.form-hint {
    font-size: 12px;
    color: var(--text-muted);
}

.demo-error {
    margin: 12px 0 0;
    padding: 10px 12px;
    border: 1px solid var(--danger);
    border-radius: var(--radius-sm);
    background: rgba(248, 113, 113, 0.1);
    color: var(--danger);
    font-size: 13px;
}

.demo-notice {
    margin: 12px 0 0;
    padding: 10px 12px;
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 13px;
}

.note-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 14px 0 0;
    padding: 0;
    list-style: none;
}

.note-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
    font-size: 13px;
}

.note-id {
    color: var(--accent);
    font-size: 11px;
}

.note-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.note-status {
    font-size: 11px;
    color: var(--text-faint);
}
</style>
