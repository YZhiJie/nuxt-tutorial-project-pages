<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const HYDRATION_CODE = `// SSR 的产物：HTML + 序列化数据（payload）
// 浏览器执行 JS，把静态 HTML 变成可交互的 Vue 应用

// 水合成本 ≈ JS 解析执行
//          + 组件树遍历
//          + 响应式状态初始化
//          + 事件监听挂载

// 组件越多、响应式对象越大，水合越慢
// 首屏不需要交互的静态内容，尽量保持纯 HTML`;

const PAYLOAD_CODE = `// 数据在 SSR 时随 HTML 下发，客户端水合直接复用，不会重复请求
const { data } = await useFetch('/api/rendering/catalog');

// Nuxt 默认开启 payload 提取：数据压缩后放进 HTML
// 关闭它会让客户端再发一次请求，首屏更慢
export default defineNuxtConfig({
    experimental: {
        payloadExtraction: true,
    },
});`;

const CLIENT_ONLY_CODE = `<ClientOnly fallback-tag="span" fallback="加载中…">
    <LazyDemoPerfHeavyPanel />
</ClientOnly>

// 适用：依赖 window / canvas / WebGL、只在浏览器存在的组件
// 注意：SSR 输出中完全没有该组件，首屏布局可能跳动
// 需要固定高度或 skeleton，避免 CLS`;

const PREFETCH_CODE = `<!-- 路由预取：NuxtLink 默认开启，悬停 / 可见时预取目标 chunk -->
<NuxtLink to="/seo/metadata" prefetch>元数据 API</NuxtLink>
<NuxtLink to="/observability/slo" :prefetch="false">按需点击才加载</NuxtLink>

// 数据预取：区分“首屏必需”与“稍后需要”
const { data } = await useFetch('/api/catalog');          // 阻塞：首屏需要
const { data: recommend } = useLazyFetch('/api/recommend'); // 非阻塞：导航后取

// 路由级：构建期预渲染，直接把 HTML 发出去
routeRules: {
    '/seo/**': { prerender: true },
    '/observability/slo': { swr: 60 },
}`;

const COSTS = [
    { factor: '组件数量', impact: '每个组件都要遍历与初始化', tip: '拆小页面、按需加载非首屏区块' },
    { factor: '响应式数据量', impact: '大对象会进入序列化 payload 与代理', tip: '只把展示需要的字段返回客户端' },
    { factor: 'DOM 规模', impact: 'HTML 下载与解析变慢', tip: '长列表用分页 / 虚拟滚动' },
    { factor: '第三方脚本', impact: '抢占主线程，推迟水合', tip: '延后加载，必要时用 iframe 隔离' },
    { factor: 'Lazy 关键组件', impact: 'HTML 已出现但事件尚未绑定', tip: '首屏可交互组件不要 Lazy' },
];

const PREFETCH_ROWS = [
    { tool: 'NuxtLink prefetch', what: '目标路由的页面 chunk（及已渲染数据）', when: '悬停 / 进入视口', cost: '额外带宽，低频页面可关闭' },
    { tool: 'useFetch', what: '首屏数据，SSR 后随 payload 下发', when: '页面 setup 同步等待', cost: '阻塞渲染，但避免客户端二次请求' },
    { tool: 'useLazyFetch / useLazyAsyncData', what: '非首屏数据', when: '导航完成后再请求', cost: '首屏更快，但数据稍后出现' },
    { tool: 'routeRules prerender', what: '构建期生成的 HTML', when: '构建时', cost: '内容更新需重新构建' },
    { tool: 'routeRules swr', what: '缓存的 HTML', when: '首次请求后按 TTL 再生', cost: '内容最多滞后一个 TTL' },
    { tool: 'link rel=preload', what: '字体、关键图片、关键脚本', when: 'HTML 解析时', cost: '滥用会与关键资源争带宽' },
];

const NOTES = [
    '不要用“水合耗时”单独判断性能：它和网络、设备、页面复杂度都相关，应该用真实用户监控（RUM）看分布。',
    'ClientOnly 不是性能优化，而是正确性边界：浏览器专属 API 放进去，普通内容不要放。',
    '预取要克制：用户可能永远不会访问的页面，预取只会浪费带宽与电量。',
    '数据预取优先在服务端完成并复用 payload，而不是客户端再发一遍。',
];
</script>

<template>
    <DocPage
        title="水合与预取"
        description="SSR 让首屏更快看到内容，但水合要把静态 HTML 变成可交互应用；预取则提前准备下一步资源。两者都要算成本，不能只看“首屏有没有 HTML”。"
        :tags="['Hydration', 'ClientOnly', 'Payload', 'Prefetch', 'NuxtLink', 'routeRules']"
    >
        <DocSection id="hydration" title="SSR 水合到底做了什么" kicker="01 · HYDRATION">
            <p class="body-text">
                SSR 返回的 HTML 已经包含内容，但按钮还不能点。浏览器必须下载并执行页面 JS，
                遍历组件树、恢复响应式状态、绑定事件，页面才算真正可交互。
                这段“从 HTML 到可交互”的时间就是水合成本。
            </p>
            <CodeBlock :code="HYDRATION_CODE" lang="ts" title="水合的四部分成本" />
            <CodeBlock :code="PAYLOAD_CODE" lang="ts" title="数据随 HTML 下发，避免二次请求" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>成本来源</th><th>影响</th><th>优化方向</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in COSTS" :key="row.factor">
                            <td class="factor">{{ row.factor }}</td>
                            <td>{{ row.impact }}</td>
                            <td>{{ row.tip }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="client-only" title="ClientOnly：明确客户端边界" kicker="02 · CLIENT ONLY">
            <p class="body-text">
                依赖 <code>window</code>、<code>canvas</code>、<code>WebGL</code>
                或只能在浏览器运行的组件，SSR 阶段无法执行。用
                <code>&lt;ClientOnly&gt;</code> 明确边界，并给 fallback，
                避免服务端报错与首屏布局跳动。
            </p>
            <CodeBlock :code="CLIENT_ONLY_CODE" lang="vue" title="ClientOnly + 固定占位" />
            <Callout type="warn" title="ClientOnly 会丢失 SSR 的 HTML">
                被包裹的内容不会出现在服务端输出里，爬虫与首屏都看不到。
                只有“确实无法在服务端运行”的组件才使用它。
            </Callout>
        </DocSection>

        <DocSection id="prefetch" title="预取矩阵" kicker="03 · PREFETCH">
            <p class="body-text">
                预取分为路由预取与数据预取。前者提前下载下一步可能用到的 chunk，
                后者提前准备数据。选择依据是“用户下一步去哪”和“这份资源是否值得提前付带宽”。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>手段</th><th>预取什么</th><th>触发时机</th><th>成本 / 注意</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in PREFETCH_ROWS" :key="row.tool">
                            <td class="mono">{{ row.tool }}</td>
                            <td>{{ row.what }}</td>
                            <td>{{ row.when }}</td>
                            <td>{{ row.cost }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="PREFETCH_CODE" lang="ts" title="路由预取与数据预取" />
        </DocSection>

        <DocSection id="notes" title="实践注意" kicker="04 · NOTES">
            <ul class="checklist">
                <li v-for="item in NOTES" :key="item">{{ item }}</li>
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

.factor {
    font-weight: 600;
    color: var(--accent);
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
