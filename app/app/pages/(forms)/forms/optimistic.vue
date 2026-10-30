<script setup lang="ts">
definePageMeta({ layout: 'docs' });

import type { Note } from '#shared/types/note';

const { data } = useFetch<Note[]>('/api/notes');

// 本地副本：乐观更新发生在副本上，渲染不再等待服务端
const notes = ref<Note[]>([]);
watch(
    data,
    (value) => {
        if (value) notes.value = value.map((note) => ({ ...note }));
    },
    { immediate: true },
);

const title = ref('');
const pendingIds = ref<number[]>([]);
const errorMessage = ref('');
const successMessage = ref('');
const simulateError = ref(false);
let tempSeq = 0;

const pendingCount = computed(() => pendingIds.value.length);

function isPending(id: number): boolean {
    return pendingIds.value.includes(id);
}

async function createOptimistic() {
    const cleanTitle = title.value.trim();
    if (!cleanTitle) return;

    // 负数临时 id：不会与真实自增 id 冲突
    const tempId = -(Date.now() + tempSeq++);
    const optimisticNote: Note = {
        id: tempId,
        title: cleanTitle,
        excerpt: cleanTitle,
        content: '',
        tags: [],
        createdAt: new Date().toISOString(),
    };

    errorMessage.value = '';
    successMessage.value = '';
    notes.value.unshift(optimisticNote);
    pendingIds.value = [...pendingIds.value, tempId];

    try {
        if (simulateError.value) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            throw new Error('模拟网络失败');
        }

        const saved = await $fetch<Note>('/api/notes', {
            method: 'POST',
            body: { title: cleanTitle, content: '' },
        });

        // 用服务端真实数据替换临时项（id / createdAt 以服务端为准）
        notes.value = notes.value.map((note) =>
            note.id === tempId ? saved : note,
        );
        title.value = '';
        successMessage.value = '创建成功，临时项已替换为服务端返回的记录';
    } catch (error) {
        // 按临时 id 精确回滚，不影响其他并发请求
        notes.value = notes.value.filter((note) => note.id !== tempId);
        errorMessage.value = getApiErrorMessage(error, '创建失败，已回滚');
    } finally {
        pendingIds.value = pendingIds.value.filter((id) => id !== tempId);
    }
}

const WHY = `// 非乐观：用户要等一次完整往返
await $fetch('/api/notes', { method: 'POST', body });
await refreshNuxtData('notes');

// 乐观：本地先插入，界面立即响应
notes.value.unshift(optimisticNote);
const saved = await $fetch('/api/notes', { method: 'POST', body });`;

const TEMP_ID = `// 负数 id 与真实自增 id 天然不冲突
const tempId = -(Date.now() + seq++);

notes.value.unshift({
    id: tempId,
    title,
    createdAt: new Date().toISOString(),
});

const saved = await $fetch<Note>('/api/notes', {
    method: 'POST',
    body: { title, content: '' },
});

// 只替换这一条，不重建整个列表
notes.value = notes.value.map((item) =>
    item.id === tempId ? saved : item,
);`;

const ROLLBACK = `try {
    const saved = await $fetch<Note>('/api/notes', { method: 'POST', body });
    notes.value = notes.value.map((item) =>
        item.id === tempId ? saved : item,
    );
} catch (error) {
    // 按临时 id 删除，不能“删掉最后一条”
    notes.value = notes.value.filter((item) => item.id !== tempId);
    errorMessage.value = getApiErrorMessage(error, '创建失败，已回滚');
} finally {
    pendingIds.value = pendingIds.value.filter((id) => id !== tempId);
}`;

const CONCURRENCY = `// 两条乐观新增同时在途
// 本地顺序： [A(temp -1), B(temp -2)]
// 服务端可能先返回 B： [B(id 10), A(id 11)]

// 因此：
// 1) 临时 id 必须唯一，用 Date.now() + 自增序号
// 2) 回滚按 id 过滤，不做索引或“最后一条”假设
// 3) 最终排序以服务端 createdAt / id 为准，可在成功后刷新一次
await refreshNuxtData();`;

const notesHint = [
    '临时项必须有稳定的唯一 id，渲染 key 才不会错位。',
    '在途项要显示 pending 标记，并禁用针对它的二次操作。',
    '回滚只删除失败的那一条，其他并发请求的结果保持不变。',
    '成功后可用服务端返回的 id 与 createdAt 校正排序。',
];
</script>

<template>
    <DocPage
        title="乐观更新"
        description="乐观更新把用户动作立即反映到界面，再异步确认服务端结果。它提升的是感知性能，代价是必须设计好临时 id、回滚和并发。"
        :tags="['乐观更新', '临时 id', '回滚', '并发']"
    >
        <DocSection id="why" title="先渲染，再确认" kicker="01 · WHY">
            <p class="body-text">
                新增、点赞、勾选这类操作，服务端通常几十到几百毫秒返回。
                如果界面一直等到响应才变化，用户会觉得卡顿。乐观更新把顺序反过来：
                先在本地假定成功并渲染，再发请求；失败时撤掉本地改动并提示。
                界面响应从“一次往返”缩短到“一次 <code>ref</code> 更新”。
            </p>
            <CodeBlock :code="WHY" lang="ts" title="等待模式 vs 乐观模式" />
            <Callout type="warn" title="不是所有写操作都适合">
                涉及金额、库存、审批状态的写操作，先渲染“成功”可能造成误导。
                这类操作更适合显式提交态；乐观更新适合低风险、可撤销、最终一致的操作。
            </Callout>
        </DocSection>

        <DocSection id="temp-id" title="临时 id 与成功替换" kicker="02 · TEMP ID">
            <p class="body-text">
                本地插入的项还没有服务端 id，但列表渲染、选中、删除都需要一个稳定标识。
                常见做法是使用负数或带前缀的字符串作为临时 id，请求成功后用服务端返回的实体
                做一次按 id 替换。临时 id 不能复用，否则并发时两条记录会互相覆盖。
            </p>
            <CodeBlock :code="TEMP_ID" lang="ts" title="负数临时 id → 服务端实体替换" />
        </DocSection>

        <DocSection id="rollback" title="失败回滚与并发" kicker="03 · ROLLBACK">
            <p class="body-text">
                失败回滚最常见的错误是“删掉最后一条”。当两个请求同时在途时，
                先失败的那个可能不是最后插入的，删错会连带丢掉另一条成功记录。
                正确做法始终是按临时 id 精确过滤。
            </p>
            <CodeBlock :code="ROLLBACK" lang="ts" title="按 id 回滚" />
            <CodeBlock :code="CONCURRENCY" lang="ts" title="并发下的顺序问题" />
            <ul class="checklist">
                <li v-for="item in notesHint" :key="item">{{ item }}</li>
            </ul>
        </DocSection>

        <DocSection id="demo" title="在线演示" kicker="04 · DEMO">
            <p class="body-text">
                下面的列表来自 <code>/api/notes</code>，新增请求发往同一个 POST 接口。
                勾选“模拟失败”后，临时项会先出现，再在 500ms 后被回滚。
                可以连续快速提交，观察多个在途项与各自的 pending 状态。
            </p>
            <DemoCard
                title="笔记乐观新增"
                desc="本地先插入负数临时 id，成功后替换；失败按临时 id 回滚。"
                badge="LIVE"
            >
                <form class="create-row" @submit.prevent="createOptimistic">
                    <input
                        v-model="title"
                        class="input"
                        placeholder="输入标题，例如：乐观更新实践"
                        maxlength="60"
                    />
                    <button class="btn" type="submit" :disabled="!title.trim()">新增</button>
                </form>

                <label class="simulate">
                    <input v-model="simulateError" type="checkbox" />
                    模拟网络失败（不发送请求，500ms 后回滚）
                </label>

                <p v-if="errorMessage" class="msg msg--error">{{ errorMessage }}</p>
                <p v-if="successMessage" class="msg msg--ok">{{ successMessage }}</p>

                <div class="list-meta">
                    <span>共 {{ notes.length }} 条</span>
                    <span v-if="pendingCount > 0" class="badge badge--warn">在途 {{ pendingCount }}</span>
                    <span v-else class="badge badge--accent">全部已确认</span>
                </div>

                <ul class="note-list">
                    <li
                        v-for="note in notes"
                        :key="note.id"
                        class="note-row"
                        :class="{ 'note-row--pending': isPending(note.id) }"
                    >
                        <div class="note-main">
                            <span class="note-title">{{ note.title }}</span>
                            <span class="note-id mono">id: {{ note.id }}</span>
                        </div>
                        <span v-if="isPending(note.id)" class="badge badge--warn">保存中…</span>
                        <span v-else class="badge badge--accent">已确认</span>
                    </li>
                </ul>

                <template #footer>
                    临时 id 为负数；若看到“保存中…”说明本地已渲染但请求尚未返回。勾选模拟失败可观察回滚。
                </template>
            </DemoCard>
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

.create-row {
    display: flex;
    gap: 10px;
}

.create-row .input {
    flex: 1;
}

.simulate {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    font-size: 12px;
    color: var(--text-muted);
    cursor: pointer;
}

.msg {
    margin: 12px 0 0;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    font-size: 13px;
}

.msg--error {
    border: 1px solid rgba(248, 113, 113, 0.4);
    background: rgba(248, 113, 113, 0.08);
    color: var(--danger);
}

.msg--ok {
    border: 1px solid var(--success-border);
    background: var(--success-soft);
    color: var(--success);
}

.list-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 16px 0 10px;
    font-size: 12px;
    color: var(--text-faint);
}

.note-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.note-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    transition: border-color 150ms ease, opacity 150ms ease;
}

.note-row--pending {
    border-style: dashed;
    border-color: rgba(251, 191, 36, 0.5);
    opacity: 0.78;
}

.note-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.note-title {
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.note-id {
    font-size: 11px;
    color: var(--text-faint);
}

.checklist {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 14px 0 0;
    padding: 0;
    list-style: none;
}

.checklist li {
    position: relative;
    padding-left: 26px;
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.7;
}

.checklist li::before {
    content: '✓';
    position: absolute;
    left: 0;
    top: 0;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 11px;
}
</style>
