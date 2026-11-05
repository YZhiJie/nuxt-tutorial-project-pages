<script setup lang="ts">
import type { Note } from '#shared/types/note';

definePageMeta({ layout: 'docs' });

// 固定 key：SSR 渲染结果与客户端水合复用同一份 payload
const { data: notes, status, error, refresh } = await useFetch<Note[]>('/api/notes', {
    key: 'data-notes',
});

// 并行请求：useAsyncData 负责编排，内部只调用一次 $fetch
const {
    data: parallel,
    status: parallelStatus,
    refresh: refreshParallel,
} = await useAsyncData('data-parallel', async () => {
    const [hello, list] = await Promise.all([
        $fetch<{ message: string }>('/api/hello'),
        $fetch<Note[]>('/api/notes'),
    ]);
    return {
        greeting: hello.message,
        noteCount: list.length,
        fetchedAt: new Date().toLocaleTimeString('zh-CN'),
    };
});

const STATUS_TEXT: Record<string, string> = {
    idle: '空闲',
    pending: '加载中',
    success: '成功',
    error: '失败',
};

const USE_FETCH_CODE = `import type { Note } from '#shared/types/note';

// 固定 key：SSR 与客户端共享同一份 payload，不重复请求
const { data, status, error, refresh } = await useFetch<Note[]>('/api/notes', {
    key: 'data-notes',
});

// status: 'idle' | 'pending' | 'success' | 'error'
// data 是 Ref<Note[] | null>，status / error / refresh 都是响应式的`;

const PARALLEL_CODE = `const { data, status, refresh } = await useAsyncData('data-parallel', async () => {
    const [hello, notes] = await Promise.all([
        $fetch<{ message: string }>('/api/hello'),
        $fetch<Note[]>('/api/notes'),
    ]);

    return {
        greeting: hello.message,
        noteCount: notes.length,
        fetchedAt: new Date().toISOString(),
    };
});

// 两个接口并行，总耗时约等于较慢的那个，而不是相加`;

const STATE_CODE = `<!-- 三态渲染：不要让用户面对空白 -->
<p v-if="status === 'pending'">加载中……</p>

<div v-else-if="status === 'error'" class="error-box">
    <p>{{ getApiErrorMessage(error) }}</p>
    <button type="button" @click="refresh()">重试</button>
</div>

<ul v-else>
    <li v-for="note in data" :key="note.id">{{ note.title }}</li>
</ul>`;

const BOUNDARY_CODE = `// useFetch：声明式、页面 setup 顶层，自动 SSR
const { data } = await useFetch('/api/notes', { key: 'data-notes' });

// useAsyncData：需要并行、依赖、第三方 SDK 时
const { data: merged } = await useAsyncData('data-merged', async () => {
    const [a, b] = await Promise.all([$fetch('/api/a'), $fetch('/api/b')]);
    return { a, b };
});

// $fetch：事件回调、提交、轮询，不参与首屏 SSR 数据
async function submit() {
    await $fetch('/api/notes', { method: 'POST', body: form });
}`;
</script>

<template>
    <DocPage
        title="useFetch 与 useAsyncData"
        description="同一个页面里同时演示声明式列表请求、状态三态与并行编排，并对比两者真正的适用边界。"
        :tags="['useFetch', 'useAsyncData', '并行请求', '状态三态', 'refresh']"
    >
        <DocSection id="usefetch" title="声明式列表请求" kicker="01 · USE FETCH">
            <p class="body-text">
                下面的列表用固定 key <code>data-notes</code> 请求 <code>/api/notes</code>。
                刷新页面时，列表在 HTML 里就已经存在；点击「重新请求」才会再次命中接口。
                状态始终在 <code>idle → pending → success / error</code> 之间流转。
            </p>
            <CodeBlock :code="USE_FETCH_CODE" lang="ts" title="useFetch + 固定 key" />

            <DemoCard title="笔记列表与三态" desc="key = data-notes；按钮触发 refresh，观察状态变化。" badge="LIVE">
                <div class="demo-toolbar">
                    <span class="badge" :class="`badge--${status === 'error' ? 'danger' : status === 'success' ? 'accent' : 'info'}`">
                        状态：{{ STATUS_TEXT[status] ?? status }}
                    </span>
                    <button type="button" class="btn btn--ghost btn--sm" :disabled="status === 'pending'" @click="refresh()">
                        {{ status === 'pending' ? '请求中……' : '重新请求' }}
                    </button>
                </div>

                <p v-if="status === 'error'" class="demo-error">
                    {{ getApiErrorMessage(error) }}
                </p>
                <p v-else-if="status === 'pending'" class="demo-empty">正在加载笔记……</p>
                <p v-else-if="!notes?.length" class="demo-empty">暂无笔记，去服务端 API 页面创建一条。</p>
                <ul v-else class="note-list">
                    <li v-for="note in notes" :key="note.id" class="note-item">
                        <span class="note-title">{{ note.title }}</span>
                        <span class="note-tags">
                            <span v-for="tag in note.tags" :key="tag" class="note-tag">#{{ tag }}</span>
                        </span>
                    </li>
                </ul>
            </DemoCard>
        </DocSection>

        <DocSection id="parallel" title="并行请求编排" kicker="02 · PARALLEL">
            <p class="body-text">
                <code>useAsyncData</code> 的价值是「把任意异步逻辑变成可缓存、可同构的数据源」。
                这里用 <code>Promise.all</code> 同时请求问候语与笔记列表，
                两个请求并行发出，结果合并成一份响应式数据。
            </p>
            <CodeBlock :code="PARALLEL_CODE" lang="ts" title="Promise.all + 固定 key" />

            <DemoCard title="并行结果" desc="key = data-parallel；两个接口的耗时被重叠，而不是累加。" badge="LIVE">
                <div class="parallel-grid">
                    <div class="parallel-item">
                        <span class="parallel-label">/api/hello</span>
                        <strong class="parallel-value">{{ parallel?.greeting ?? '—' }}</strong>
                    </div>
                    <div class="parallel-item">
                        <span class="parallel-label">/api/notes 数量</span>
                        <strong class="parallel-value">{{ parallel?.noteCount ?? '—' }}</strong>
                    </div>
                    <div class="parallel-item">
                        <span class="parallel-label">状态</span>
                        <strong class="parallel-value">{{ STATUS_TEXT[parallelStatus] ?? parallelStatus }}</strong>
                    </div>
                    <div class="parallel-item">
                        <span class="parallel-label">完成时间</span>
                        <strong class="parallel-value mono">{{ parallel?.fetchedAt ?? '—' }}</strong>
                    </div>
                </div>
                <div class="demo-toolbar demo-toolbar--end">
                    <button type="button" class="btn btn--sm" :disabled="parallelStatus === 'pending'" @click="refreshParallel()">
                        {{ parallelStatus === 'pending' ? '并行请求中……' : '重新并行请求' }}
                    </button>
                </div>
            </DemoCard>
        </DocSection>

        <DocSection id="state" title="三态与刷新" kicker="03 · STATE">
            <p class="body-text">
                新手最常见的错误是只处理成功态。真实页面至少需要三种视图：
                加载中给反馈、失败时给原因与重试、成功时才渲染业务内容。
            </p>
            <CodeBlock :code="STATE_CODE" lang="vue" title="三态渲染模板" />
            <Callout type="tip" title="刷新粒度">
                <code>refresh()</code> 只刷新当前数据源；
                <code>refreshNuxtData('data-notes')</code> 可以刷新所有使用同一 key 的组件。
                写操作成功后，优先刷新相关 key，而不是整页重载。
            </Callout>
        </DocSection>

        <DocSection id="boundary" title="何时不用 useFetch" kicker="04 · BOUNDARY">
            <p class="body-text">
                不要把每个请求都包装成响应式数据源。事件回调、提交、轮询这类“动作型”请求，
                用 <code>$fetch</code> 更直接，也不会产生无人订阅的缓存条目。
            </p>
            <CodeBlock :code="BOUNDARY_CODE" lang="ts" title="三种 API 的落地位置" />
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

.demo-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 14px;
}

.demo-toolbar--end {
    justify-content: flex-end;
    margin: 14px 0 0;
}

.demo-error {
    margin: 0;
    padding: 10px 12px;
    border: 1px solid var(--danger);
    border-radius: var(--radius-sm);
    background: rgba(248, 113, 113, 0.1);
    color: var(--danger);
    font-size: 13px;
}

.demo-empty {
    margin: 0;
    color: var(--text-muted);
    font-size: 13px;
}

.note-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.note-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
}

.note-title {
    font-size: 14px;
    font-weight: 600;
}

.note-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.note-tag {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent);
}

.parallel-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
}

.parallel-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
}

.parallel-label {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-faint);
}

.parallel-value {
    font-size: 15px;
    word-break: break-word;
}
</style>
