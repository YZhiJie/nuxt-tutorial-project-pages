<script setup lang="ts">
import type { Note } from '#shared/types/note';

definePageMeta({ layout: 'docs' });

type SortKey = 'new' | 'old' | 'title';

function normalizeSort(value: unknown): SortKey {
    return value === 'old' || value === 'title' ? value : 'new';
}

const route = useRoute();
const router = useRouter();

const keyword = ref(String(route.query.q ?? ''));
const sort = ref<SortKey>(normalizeSort(route.query.sort));

// URL → UI：浏览器前进 / 后退时把 query 回填到控件
watch(
    () => [route.query.q, route.query.sort],
    ([q, s]) => {
        const nextKeyword = String(q ?? '');
        const nextSort = normalizeSort(s);
        if (nextKeyword !== keyword.value) keyword.value = nextKeyword;
        if (nextSort !== sort.value) sort.value = nextSort;
    },
);

// UI → URL：防抖后用 replace 写回，避免每个按键都制造历史记录
let timer: ReturnType<typeof setTimeout> | undefined;
watch([keyword, sort], ([q, s]) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
        router.replace({
            query: {
                ...(q ? { q } : {}),
                ...(s !== 'new' ? { sort: s } : {}),
            },
        });
    }, 200);
});

onBeforeUnmount(() => clearTimeout(timer));

// 查询条件来自 URL：地址栏变化时 useFetch 自动刷新
const { data: notes, status } = await useFetch<Note[]>('/api/notes', {
    key: 'state-url-notes',
    query: computed(() => (route.query.q ? { q: String(route.query.q) } : {})),
});

const visibleNotes = computed(() => {
    const list = [...(notes.value ?? [])];
    if (sort.value === 'title') {
        list.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
    } else if (sort.value === 'old') {
        list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    } else {
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return list;
});

const URL_CODE = `const route = useRoute();
const router = useRouter();

const keyword = ref(String(route.query.q ?? ''));
const sort = ref<'new' | 'old' | 'title'>(normalizeSort(route.query.sort));

// URL → UI：前进 / 后退时回填控件
watch(() => route.query, syncFromRoute);

// UI → URL：用 replace 避免每个按键都进入历史栈
watch([keyword, sort], () => {
    router.replace({
        query: {
            ...(keyword.value ? { q: keyword.value } : {}),
            ...(sort.value !== 'new' ? { sort: sort.value } : {}),
        },
    });
});`;

const FETCH_CODE = `// query 是响应式的：地址栏变化 → 自动重新取数
const { data, status } = await useFetch<Note[]>('/api/notes', {
    key: 'state-url-notes',
    query: computed(() => (route.query.q ? { q: String(route.query.q) } : {})),
});

// 排序只影响展示，不必回传服务端
const visible = computed(() => {
    const list = [...(data.value ?? [])];
    return sort.value === 'title'
        ? list.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
        : list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
});`;

const SEO_CODE = `// 标题随查询条件变化，搜索结果页也能被正确索引
useSeoMeta({
    title: () => \`搜索：\${route.query.q || '全部笔记'}\`,
    description: () => \`在知识站中搜索「\${route.query.q || '笔记'}」。\`,
});

// 分享链接天然携带完整视图状态
// /state/url?q=nuxt&sort=title`;

const pitfalls = [
    '不要把敏感信息（token、用户 id）放进 query，它会进入日志、Referer 与分享链接。',
    '连续输入时使用 replace + 防抖；需要保留每一步历史时才用 push。',
    'URL 状态只放视图维度：搜索词、排序、筛选、页码，而不是整份业务数据。',
    '从 URL 读取的值一律当字符串处理，并做枚举 / 范围校验。',
];
</script>

<template>
    <DocPage
        title="URL 即状态"
        description="把搜索词与排序放进 query，视图就变成可分享、可回退、可被搜索引擎抓取的地址。URL 是天然的持久化状态容器。"
        :tags="['useRoute', 'useRouter', 'query 同步', '可分享', 'SEO']"
    >
        <DocSection id="why" title="为什么把状态放进 URL" kicker="01 · RATIONALE">
            <p class="body-text">
                组件内状态随页面卸载消失，Pinia 状态无法分享给同事。
                而 URL 状态天然具备三种能力：复制链接即可分享、浏览器前进后退可回退、
                搜索引擎可以抓取不同查询结果。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>能力</th><th>组件状态</th><th>Pinia</th><th>URL 状态</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>刷新后保留</td><td>否</td><td>否</td><td>是</td></tr>
                        <tr><td>可分享</td><td>否</td><td>否</td><td>是</td></tr>
                        <tr><td>前进 / 后退</td><td>否</td><td>否</td><td>是</td></tr>
                        <tr><td>SEO 可索引</td><td>否</td><td>否</td><td>是</td></tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="sync" title="双向同步" kicker="02 · SYNC">
            <p class="body-text">
                同步必须是双向的：控件变化写回 URL，URL 变化（前进 / 后退）回填控件。
                写入使用 <code>router.replace</code> 并加防抖，避免历史栈爆炸。
            </p>
            <CodeBlock :code="URL_CODE" lang="ts" title="route ↔ 控件" />
            <CodeBlock :code="FETCH_CODE" lang="ts" title="响应式 query 驱动取数" />
        </DocSection>

        <DocSection id="demo" title="搜索与排序" kicker="03 · LIVE">
            <p class="body-text">
                在下方输入或切换排序，地址栏会同步变化；点击浏览器后退可以回到上一个查询。
                刷新页面后，搜索条件与结果依然保持一致。
            </p>
            <DemoCard title="URL 驱动的搜索" desc="?q= 与 ?sort= 双向同步，列表随地址栏刷新。" badge="LIVE">
                <div class="url-controls">
                    <input
                        v-model="keyword"
                        class="input"
                        type="search"
                        placeholder="搜索标题或摘要，如：Pinia"
                    />
                    <select v-model="sort" class="select sort-select">
                        <option value="new">最新优先</option>
                        <option value="old">最早优先</option>
                        <option value="title">按标题</option>
                    </select>
                </div>

                <p class="url-echo">
                    <code>{{ route.fullPath }}</code>
                    <span class="url-status">{{ status === 'pending' ? '请求中……' : `共 ${visibleNotes.length} 条` }}</span>
                </p>

                <p v-if="status === 'pending'" class="url-empty">正在加载……</p>
                <p v-else-if="!visibleNotes.length" class="url-empty">没有匹配的笔记，试试其他关键词。</p>
                <ul v-else class="note-list">
                    <li v-for="note in visibleNotes" :key="note.id" class="note-item">
                        <span class="note-title">{{ note.title }}</span>
                        <span class="note-meta mono">{{ formatDate(note.createdAt) }}</span>
                    </li>
                </ul>
            </DemoCard>
        </DocSection>

        <DocSection id="seo" title="SEO 与分享" kicker="04 · SEO">
            <p class="body-text">
                查询条件进入 URL 后，可以用 <code>useSeoMeta</code> 生成动态标题与描述，
                让搜索结果页也具备语义。分享链接天然携带完整视图状态。
            </p>
            <CodeBlock :code="SEO_CODE" lang="ts" title="动态元数据" />
            <Callout type="warn" title="不要把所有状态都塞进 URL">
                URL 太长会伤害可读性与缓存命中。只放用户希望分享或回退的维度，
                临时 UI 状态（悬浮、展开）仍然留在组件里。
            </Callout>
        </DocSection>

        <DocSection id="pitfalls" title="常见坑" kicker="05 · PITFALLS">
            <ul class="checklist">
                <li v-for="item in pitfalls" :key="item">{{ item }}</li>
            </ul>
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

.url-controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 150px;
    gap: 10px;
}

.sort-select {
    height: 100%;
}

.url-echo {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 14px 0 12px;
    font-size: 12px;
    color: var(--text-muted);
}

.url-status {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent);
}

.url-empty {
    margin: 0;
    font-size: 13px;
    color: var(--text-muted);
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
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 9px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
}

.note-title {
    font-size: 13px;
    font-weight: 600;
}

.note-meta {
    font-size: 11px;
    color: var(--text-faint);
    white-space: nowrap;
}

.checklist {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.checklist li {
    position: relative;
    padding-left: 24px;
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.7;
}

.checklist li::before {
    content: '→';
    position: absolute;
    left: 0;
    color: var(--accent);
    font-family: var(--font-mono);
}

@media (max-width: 520px) {
    .url-controls {
        grid-template-columns: 1fr;
    }
}
</style>
