<script setup lang="ts">
definePageMeta({ layout: 'docs' });

interface CatalogItem {
    id: string;
    name: string;
    price: number;
}

interface CatalogPayload {
    generatedAt: string;
    version: string;
    items: CatalogItem[];
}

const { data, refresh } = useFetch<CatalogPayload>('/api/rendering/catalog', {
    key: 'rendering-catalog',
});

const refreshing = ref(false);

async function reload() {
    refreshing.value = true;
    try {
        await refresh();
    } finally {
        refreshing.value = false;
    }
}

const CLIENT_CODE = `interface CatalogPayload {
    generatedAt: string;
    version: string;
    items: Array<{ id: string; name: string; price: number }>;
}

const { data, refresh } = useFetch<CatalogPayload>(
    '/api/rendering/catalog',
    { key: 'rendering-catalog' },
);

// 60 秒内刷新，generatedAt 通常保持不变，说明命中了缓存
await refresh();`;

const SERVER_CODE = `const ITEMS = [
    { id: 'nuxt-pro', name: 'Nuxt Pro 年度授权', price: 199 },
    { id: 'nitro-node', name: 'Nitro Node 部署包', price: 89 },
    { id: 'ui-kit', name: '企业组件库', price: 299 },
];

export default defineEventHandler((event) => {
    // 公共缓存 60 秒，可被 CDN 复用
    setResponseHeader(event, 'cache-control', 'public, s-maxage=60');

    return {
        generatedAt: new Date().toISOString(),
        version: 'v2026.10.30',
        items: ITEMS,
    };
});`;

const RULES_CODE = `export default defineNuxtConfig({
    routeRules: {
        '/rendering/isr': { swr: 60 },
    },
});

// swr = stale-while-revalidate：
// 缓存过期后先返回旧内容，同时在后台重新生成
// 部分平台支持 isr 别名，语义接近，按部署环境选择`;

const INVALIDATE_CODE = `# 方案 A：发布事件触发平台 purge / revalidate API
# 方案 B：重新构建该路由（适合低频内容）
# 方案 C：等待 TTL 自然过期（最终一致，最简单）

# 关键：共享缓存必须只包含公共数据，
# 用户相关的价格、库存、权限不能进入 s-maxage 缓存`;

const states = [
    { state: '首次请求', behavior: '缓存未命中，服务端渲染并写入缓存', latency: '较高' },
    { state: '60 秒内', behavior: '直接返回缓存 HTML / JSON', latency: '最低' },
    { state: '超过 60 秒', behavior: '先返回旧内容，后台重新生成', latency: '低（用户无感）' },
];

const pitfalls = [
    '把用户身份写进 SWR 页面：不同用户会拿到同一份缓存，造成越权或串号。',
    '以为 refresh() 一定拿到新数据：TTL 内服务端仍可能返回缓存。',
    '缓存过期不等于立即更新：后台再生有延迟，重要内容需要主动 purge。',
    '在 dev 下观察不到完整的 CDN / 共享缓存行为，需 build + preview 验证。',
];
</script>

<template>
    <DocPage
        title="ISR / SWR 增量再生"
        description="ISR/SWR 把“静态的速度”和“运行期的更新能力”结合起来：请求命中旧缓存，后台按 TTL 重新生成。本页用商品目录演示 60 秒缓存窗口。"
        :tags="['ISR', 'SWR', 'swr: 60', 'stale-while-revalidate', '缓存失效']"
    >
        <DocSection id="principle" title="增量再生原理" kicker="01 · PRINCIPLE">
            <p class="body-text">
                SWR 的核心是“先给旧的，再去更新”。缓存超过 TTL 后，第一个请求不会等待新内容生成，
                而是立即返回旧副本，同时服务端在后台重新渲染并替换缓存。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>阶段</th><th>服务端行为</th><th>用户感知延迟</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in states" :key="row.state">
                            <td>{{ row.state }}</td>
                            <td>{{ row.behavior }}</td>
                            <td>{{ row.latency }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <Callout type="info" title="ISR 与 SWR 的关系">
                ISR（增量静态再生）强调“静态页面按需再生”，SWR 强调“旧内容 + 后台校验”。
                在 Nuxt/Nitro 里通常用 <code>swr</code> 表达同一类能力；具体平台可能额外提供 <code>isr</code> 别名。
            </Callout>
        </DocSection>

        <DocSection id="live" title="观察 60 秒缓存窗口" kicker="02 · LIVE">
            <p class="body-text">
                页面数据来自 <code>/api/rendering/catalog</code>，接口设置
                <code>public, s-maxage=60</code>。在 60 秒内多次刷新，<code>generatedAt</code>
                很可能保持不变；超过窗口后再刷新，才会看到新的时间。
            </p>
            <DemoCard title="商品目录快照" desc="generatedAt 是接口生成时间；version 用于标识内容版本。" badge="LIVE">
                <dl class="stat-grid">
                    <div class="stat">
                        <dt>generatedAt</dt>
                        <dd class="mono">{{ data?.generatedAt ?? '加载中…' }}</dd>
                    </div>
                    <div class="stat">
                        <dt>version</dt>
                        <dd class="mono">{{ data?.version ?? '—' }}</dd>
                    </div>
                    <div class="stat">
                        <dt>条目数</dt>
                        <dd class="mono">{{ data?.items?.length ?? 0 }}</dd>
                    </div>
                </dl>
                <div class="table-wrap item-table">
                    <table>
                        <thead>
                            <tr><th>ID</th><th>名称</th><th>价格</th></tr>
                        </thead>
                        <tbody>
                            <tr v-for="item in data?.items ?? []" :key="item.id">
                                <td class="mono">{{ item.id }}</td>
                                <td>{{ item.name }}</td>
                                <td class="mono">¥{{ item.price }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <template #footer>
                    <button class="btn btn--sm" :disabled="refreshing" @click="reload">
                        {{ refreshing ? '请求中…' : '刷新并观察 generatedAt' }}
                    </button>
                </template>
            </DemoCard>
            <CodeBlock :code="CLIENT_CODE" lang="ts" title="页面侧读取" />
        </DocSection>

        <DocSection id="rules" title="routeRules 与事件失效" kicker="03 · RULES">
            <p class="body-text">
                页面的缓存窗口由 <code>routeRules.swr</code> 控制；接口还可以单独设置
                <code>s-maxage</code>。两者共同决定“多久内复用旧内容”。
            </p>
            <CodeBlock :code="RULES_CODE" lang="ts" title="当前项目配置" />
            <CodeBlock :code="SERVER_CODE" lang="ts" title="server/api/rendering/catalog.get.ts" />
            <CodeBlock :code="INVALIDATE_CODE" lang="text" title="主动失效" />
            <Callout type="danger" title="共享缓存绝不能包含个人数据">
                带 <code>public</code> / <code>s-maxage</code> 的响应会被 CDN 与中间层复用。
                价格、库存、权限、购物车都必须走私有接口或 <code>no-store</code>。
            </Callout>
        </DocSection>

        <DocSection id="boundary" title="与 SSG / SSR 的边界" kicker="04 · BOUNDARY">
            <p class="body-text">
                内容“需要更新但不必实时”时选 SWR；内容“发布后才能变”选 SSG；
                内容“每次都必须新”选 SSR。三者的成本与新鲜度是连续光谱，不是互斥标签。
            </p>
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

.stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    margin: 0;
}

.stat {
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
}

.stat dt {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-faint);
}

.stat dd {
    margin: 6px 0 0;
    font-size: 14px;
    color: var(--accent);
    word-break: break-all;
}

.item-table {
    margin-top: 14px;
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
    padding-left: 26px;
    font-size: 14px;
    line-height: 1.7;
    color: var(--text-muted);
}

.checklist li::before {
    content: '!';
    position: absolute;
    left: 0;
    top: 0;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: rgba(251, 191, 36, 0.15);
    color: var(--warn);
    font-family: var(--font-mono);
    font-size: 11px;
}
</style>
