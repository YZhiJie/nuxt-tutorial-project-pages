<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const FLOW_CODE = `// ① SSR 期间：useFetch 发起一次请求
const { data } = await useFetch('/api/notes', { key: 'data-notes' });

// ② Nuxt 将 data 写入 payload，HTML 与数据一起下发
// ③ 客户端水合：从 payload 恢复 data，不发起第二次网络请求
// ④ 组件复用：第二个组件使用同一个 key，直接共享缓存
// ⑤ 失效：refresh() / refreshNuxtData(key) / 依赖变化`;

const KEY_CODE = `// ✅ 业务语义 + 资源标识：稳定、可读、可跨组件复用
'data-notes'
'data-note-42'
'data-notes:q=nuxt&sort=new'

// ❌ 随机值 / 时间戳：每次都不命中缓存
\`data-\${Math.random()}\`

// ❌ 省略 key：按调用位置生成，SSR 与客户端可能得到不同的键
useFetch('/api/notes')`;

const CACHED_CODE = `const { data, refresh } = await useFetch<Note[]>('/api/notes', {
    key: 'data-notes',
    getCachedData(key, nuxtApp) {
        // 先读 SSR payload，再读预渲染静态数据
        return nuxtApp.payload.data[key] ?? nuxtApp.static.data[key];
    },
});

// getCachedData 返回非 undefined 时，useFetch 会直接使用它并跳过请求`;

const REFRESH_CODE = `const { data, status, refresh, clear } = await useFetch('/api/notes', {
    key: 'data-notes',
});

await refresh();                // 重新请求并更新同一份缓存
clear();                        // 清空数据与缓存条目
await refreshNuxtData('data-notes'); // 刷新全站使用该 key 的所有组件

// 依赖变化：把查询条件做成响应式，配合稳定 key
const route = useRoute();
useFetch('/api/notes', {
    key: 'data-notes',
    query: computed(() => ({ q: route.query.q ?? '' })),
});`;

const NITRO_CODE = `// server/api/notes/index.get.ts —— 服务端缓存，多用户共享
export default defineCachedEventHandler(
    async () => listNotes(),
    {
        maxAge: 60,                      // 60 秒内直接返回缓存
        swr: true,                       // 过期后先返回旧值，后台再生
        name: 'notes-list',
        getKey: (event) => \`notes:\${getQuery(event).q ?? ''}\`,
    },
);

// Nitro storage：nuxt.config.ts 中已配置 data 命名空间（fs 驱动）
const storage = useStorage<Note[]>('data');
await storage.setItem('notes', notes);
const cached = await storage.getItem('notes');`;

const INVALIDATE_CODE = `// 写操作后按影响范围失效，而不是整页刷新
await $fetch('/api/notes', { method: 'POST', body });
await refreshNuxtData('data-notes');        // 列表
await refreshNuxtData('data-note-42');      // 详情

// 页面卸载时清理临时缓存（谨慎使用，会影响同 key 的其他组件）
clearNuxtData('data-notes');`;

const layers = [
    { layer: '客户端 payload', scope: '单次页面访问', hit: 'SSR → 水合复用', clear: 'refresh / clear' },
    { layer: 'useFetch 内存缓存', scope: '同一 key 的组件', hit: '跨组件共享', clear: 'refreshNuxtData' },
    { layer: 'Nitro 服务端缓存', scope: '所有用户 / 所有请求', hit: 'defineCachedEventHandler', clear: 'maxAge / swr 失效' },
];
</script>

<template>
    <DocPage
        title="缓存与失效"
        description="Nuxt 的缓存不是一层，而是 payload、客户端缓存与 Nitro 服务端缓存三层。理解每一层的生命周期，才能避免“数据不更新”或“缓存穿透”。"
        :tags="['请求去重', '缓存 key', 'getCachedData', 'refresh', 'Nitro storage']"
    >
        <DocSection id="flow" title="SSR 请求去重" kicker="01 · DEDUPLICATION">
            <p class="body-text">
                同一次页面访问中，相同 key 的数据只会请求一次：服务端拿到结果后序列化进 payload，
                客户端水合时直接读取。去重的前提是 <strong>key 稳定且可预测</strong>。
            </p>
            <CodeBlock :code="FLOW_CODE" lang="text" title="一次访问的缓存生命周期" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>层</th><th>作用范围</th><th>命中方式</th><th>失效方式</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in layers" :key="row.layer">
                            <td>{{ row.layer }}</td>
                            <td>{{ row.scope }}</td>
                            <td class="mono">{{ row.hit }}</td>
                            <td class="mono">{{ row.clear }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="key" title="key 设计" kicker="02 · KEY DESIGN">
            <p class="body-text">
                key 是缓存的地址。好的 key 具备三个特征：业务语义清晰、随查询条件变化、
                不含随机或时间因素。查询条件放进 <code>query</code>，key 保持稳定。
            </p>
            <CodeBlock :code="KEY_CODE" lang="ts" title="key 的正例与反例" />
            <Callout type="warn" title="key 冲突也是一种 bug">
                两个不同接口使用同一个 key，会让后发的请求覆盖先到的数据。
                建议统一前缀：<code>data-*</code>、<code>user-*</code>、<code>admin-*</code>。
            </Callout>
        </DocSection>

        <DocSection id="cached-data" title="getCachedData" kicker="03 · CACHED DATA">
            <p class="body-text">
                默认情况下 <code>useFetch</code> 已经会读 payload。
                <code>getCachedData</code> 用于接管命中逻辑，例如接入自定义内存缓存、
                或让静态预渲染的数据优先复用。
            </p>
            <CodeBlock :code="CACHED_CODE" lang="ts" title="自定义缓存命中" />
            <Callout type="info" title="返回 undefined 才会发请求">
                <code>getCachedData</code> 返回任何非 <code>undefined</code> 的值都会被直接采用。
                判断条件写错，轻则 stale 数据，重则永远不请求。
            </Callout>
        </DocSection>

        <DocSection id="refresh" title="手动刷新与失效" kicker="04 · REFRESH">
            <p class="body-text">
                <code>refresh()</code> 刷新当前数据源，<code>refreshNuxtData(key)</code>
                刷新全站同 key 的数据，<code>clear()</code> 清空数据与缓存条目。
                写操作后按影响面选择最小刷新范围。
            </p>
            <CodeBlock :code="REFRESH_CODE" lang="ts" title="三个失效 API" />
            <CodeBlock :code="INVALIDATE_CODE" lang="ts" title="写后失效的推荐顺序" />
        </DocSection>

        <DocSection id="nitro" title="Nitro 服务端缓存与存储" kicker="05 · SERVER CACHE">
            <p class="body-text">
                客户端缓存只影响一个用户的一次访问；跨用户共享的热点数据应放在 Nitro 层。
                <code>defineCachedEventHandler</code> 提供 TTL 与 SWR，
                <code>useStorage</code> 则负责持久化。
            </p>
            <CodeBlock :code="NITRO_CODE" lang="ts" title="服务端缓存 + 存储" />
            <ul class="checklist">
                <li>缓存 key 必须包含影响结果的查询参数，否则不同筛选会互相污染。</li>
                <li>写接口成功后主动失效对应 key，或使用较短的 maxAge 接受最终一致。</li>
                <li>个性化数据（购物车、会话）不要放进共享的服务端缓存。</li>
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

.body-text strong {
    color: var(--text);
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
