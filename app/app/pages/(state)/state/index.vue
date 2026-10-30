<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const quadrant = [
    {
        key: '组件状态',
        scope: '单个组件内部',
        carrier: 'ref / reactive / computed',
        example: '输入框草稿、展开收起、分页游标',
    },
    {
        key: '跨组件状态',
        scope: '同一页面或全局共享',
        carrier: 'useState / Pinia',
        example: '主题偏好、登录用户、全局计数',
    },
    {
        key: '服务端状态',
        scope: '远程数据的生命周期',
        carrier: 'useFetch / useAsyncData',
        example: '笔记列表、订单详情、分页数据',
    },
    {
        key: 'URL 状态',
        scope: '可分享、可回退的视图',
        carrier: 'route.query / route.params',
        example: '搜索词、排序、筛选、分页页码',
    },
];

const SELECT_CODE = `// ① 只在一个组件里用：ref 足够
const draft = ref('');

// ② 组件树里共享，且需要 SSR 同构：useState
const keyword = useState('docs:search-keyword', () => '');

// ③ 领域状态、跨页面共享、需要 devtools 与 action：Pinia
const cart = useCartStore();
cart.add(item);

// ④ 用户可见/可分享/可回退：URL query
router.replace({ query: { q: keyword.value, sort: 'new' } });

// ⑤ 服务端数据：交给 useFetch，不要手动塞进 Pinia
const { data: notes } = await useFetch('/api/notes', { key: 'data-notes' });`;

const DECISION_CODE = `// 决策顺序：先问“这个状态需要被谁看到、需要活多久”
if (只在一个组件内) return 'ref / reactive';
if (需要跨组件且无需持久化) return 'useState';
if (有领域规则、跨页面、需要订阅) return 'Pinia';
if (需要分享 / 收藏 / 回退) return 'URL query';
if (来自服务端) return 'useFetch / useAsyncData';

// 一个常见组合：服务端数据缓存 + 局部 UI 状态
const { data } = await useFetch('/api/notes', { key: 'data-notes' });
const selectedId = ref<number | null>(null);`;

const ANTI_CODE = `// ❌ 把服务端数据复制进 Pinia，再手动同步
const store = useNotesStore();
store.notes = await $fetch('/api/notes');

// ✅ 服务端数据留在 useFetch，Pinia 只存领域状态
const { data: notes } = await useFetch('/api/notes', { key: 'data-notes' });

// ❌ 组件内部状态用全局单例，导致多个实例互相污染
const open = useState('dialog-open', () => false);

// ✅ 每个实例自己的 UI 状态
const open = ref(false);`;

const pitfalls = [
    '组件状态提升为全局状态前，先确认它真的需要跨组件共享。',
    'useState 的 key 必须全局唯一；拼错不会报错，只会悄悄创建第二份状态。',
    'URL 状态只放“用户希望分享或回退”的维度，不要把敏感信息写进 query。',
    '服务端数据不要复制进 Pinia；缓存与领域状态分离，避免双向同步。',
];
</script>

<template>
    <DocPage
        title="状态管理"
        description="状态管理的难点不是“用什么库”，而是判断一份状态应该由谁持有、活多久、是否需要被分享。先分类，再选工具。"
        :tags="['useState', 'Pinia', 'URL 状态', '服务端状态', '四象限']"
    >
        <DocSection id="quadrant" title="状态四象限" kicker="01 · QUADRANT">
            <p class="body-text">
                按「作用范围」与「生命周期」划分，前端状态可以落到四个象限。
                每个象限都有默认载体，跨象限搬运状态是大多数状态 bug 的根源。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>象限</th><th>作用范围</th><th>默认载体</th><th>典型例子</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in quadrant" :key="row.key">
                            <td class="mono">{{ row.key }}</td>
                            <td>{{ row.scope }}</td>
                            <td class="mono">{{ row.carrier }}</td>
                            <td>{{ row.example }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="select" title="useState vs Pinia vs URL" kicker="02 · SELECT">
            <p class="body-text">
                <code>useState</code> 是 SSR 安全的全局 ref，轻量、无样板代码；
                Pinia 提供领域建模、devtools 与订阅；URL 状态胜在可分享、可回退。
                三者不是替代关系，而是不同生命周期的载体。
            </p>
            <CodeBlock :code="SELECT_CODE" lang="ts" title="四种载体的最小示例" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>维度</th><th>useState</th><th>Pinia</th><th>URL</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>SSR 安全</td><td>是</td><td>是（需正确初始化）</td><td>是（来自请求）</td></tr>
                        <tr><td>可分享</td><td>否</td><td>否</td><td>是</td></tr>
                        <tr><td>可回退</td><td>否</td><td>否</td><td>是</td></tr>
                        <tr><td>devtools</td><td>有限</td><td>完整时间旅行</td><td>浏览器历史</td></tr>
                        <tr><td>适用规模</td><td>少量共享值</td><td>领域 / 跨页面</td><td>视图维度</td></tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="decision" title="决策路径" kicker="03 · DECISION">
            <p class="body-text">
                选型可以简化为一条判断链。绝大多数页面最终是「服务端数据 + 少量本地 UI 状态」，
                不需要引入全局 store。
            </p>
            <CodeBlock :code="DECISION_CODE" lang="ts" title="从问题出发的决策链" />
            <Callout type="tip" title="状态归属比状态库更重要">
                先确定“谁拥有这份状态”，再决定用哪个 API。
                反过来先选库，往往会得到一份既没人清理、也说不清生命周期的全局状态。
            </Callout>
        </DocSection>

        <DocSection id="anti" title="常见反模式" kicker="04 · ANTI-PATTERNS">
            <CodeBlock :code="ANTI_CODE" lang="ts" title="反例与重构" />
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

.checklist {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 16px 0 0;
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
</style>
