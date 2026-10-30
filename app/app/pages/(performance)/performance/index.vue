<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const CRITICAL_STAGES = [
    { stage: 'DNS / TLS', budget: '≤ 100ms', note: '复用连接、启用 TLS 1.3、同源部署减少握手' },
    { stage: 'TTFB', budget: '缓存命中 ≤ 100ms；SSR ≤ 600ms', note: '优先静态化或 SWR，避免首屏直连慢接口' },
    { stage: 'HTML 下载', budget: '≤ 30KB（gzip）', note: '减少首屏无关 DOM 与内联数据' },
    { stage: '关键 CSS', budget: '≤ 30KB', note: '首屏样式同步，其余样式延迟或按需加载' },
    { stage: '初始 JS', budget: '≤ 170KB（gzip）', note: '按路由分包，重组件用 Lazy 前缀移出首屏' },
    { stage: '水合', budget: '中端手机 ≤ 1s', note: '缩小响应式粒度，避免整页巨型组件' },
];

const BUNDLE_GROUPS = [
    { group: 'framework / vendor', content: 'Vue、Vue Router、Nuxt runtime', strategy: '版本稳定，靠长期缓存；不要重复打包同一依赖' },
    { group: 'entry', content: 'app 入口、全局插件、布局', strategy: '保持精简；重型逻辑不要放插件同步执行' },
    { group: 'page chunks', content: '按路由自动分包', strategy: '首屏页面控制体积，低频页面可预渲染壳' },
    { group: 'component chunks', content: 'Lazy 组件拆出的独立分包', strategy: '交互后才下载；避免首屏关键组件被 Lazy 化' },
    { group: 'css / assets', content: '全局样式、字体、图片', strategy: '字体子集化 + woff2；图片用合适尺寸与现代格式' },
];

const CRITICAL_CODE = `<!-- 首屏只保留必须同步的资源 -->
<link
    rel="preload"
    href="/fonts/inter-latin.woff2"
    as="font"
    type="font/woff2"
    crossorigin
>

<!-- 非关键脚本延后执行，不阻塞解析 -->
<script defer src="/scripts/analytics.js"><\/script>

<!-- 非首屏图片不预加载，交给懒加载 -->
<img src="/hero.webp" width="960" height="480" alt="产品截图">`;

const LAZY_CODE = `// 交互后才出现的重组件：使用 Lazy 前缀
<LazyDemoPerfHeavyPanel v-if="showPanel" :rows="12" />

// 需要 loading / 超时 / 重试时显式使用 defineAsyncComponent
import { defineAsyncComponent } from 'vue';

const HeavyPanel = defineAsyncComponent({
    loader: () => import('~/components/demo/perf/DemoPerfHeavyPanel.vue'),
    delay: 200,
    timeout: 3000,
});`;

const PREFETCH_CODE = `<!-- NuxtLink 自动预取目标路由的页面 chunk 与数据 -->
<NuxtLink to="/observability/metrics" prefetch>查看指标页</NuxtLink>

<!-- 数据预取：非阻塞，导航后再等待 -->
const { data } = useLazyFetch('/api/rendering/catalog');

// 路由级预取：构建期生成静态 HTML
routeRules: {
    '/seo/**': { prerender: true },
}`;

const CACHE_ROWS = [
    { layer: '浏览器私有缓存', header: 'private, max-age=0, must-revalidate', fit: '登录态页面、个人数据' },
    { layer: 'CDN 共享缓存', header: 'public, s-maxage=60, stale-while-revalidate=300', fit: '公共列表、营销页' },
    { layer: 'SWR 路由规则', header: 'routeRules: { swr: 60 }', fit: '可容忍 60 秒滞后的公共内容' },
    { layer: '静态资源', header: 'public, max-age=31536000, immutable', fit: '_nuxt/ 下带哈希的 JS / CSS' },
    { layer: '请求去重', header: 'useFetch 的 key', fit: '同一页面多次取同一数据' },
];

const CHECKLIST = [
    '先用真实设备与慢网测首屏，再决定优化顺序；不要只在本机看 Lighthouse 分数。',
    '把初始 JS 设成预算（例如 170KB gzip），超出时先拆分包，而不是加服务器。',
    '首屏可见内容不要懒加载；交互后才出现的重组件才用 Lazy。',
    '图片写死宽高，避免布局抖动；首屏图用 WebP / AVIF 并配合 srcset。',
    '缓存分层设计：静态资源长缓存、公共页面短缓存、个人数据不共享。',
];
</script>

<template>
    <DocPage
        title="性能优化"
        description="性能不是某一个技巧，而是五条主线协同：首屏关键路径、打包体积、懒加载、数据预取与缓存。先量化，再优化，最后用预算防止回退。"
        :tags="['关键路径', 'Bundle', 'Lazy', 'Prefetch', 'Cache', '预算']"
    >
        <DocSection id="critical" title="首屏关键路径" kicker="01 · CRITICAL PATH">
            <p class="body-text">
                首屏关键路径决定用户多久看到内容、多久能点击。它由 DNS、TTFB、HTML、
                CSS、JS 与水合串成一条链，任何一段超预算都会拖慢后续。
                优化顺序应该是：先砍请求与体积，再谈并行与预加载。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>阶段</th><th>预算（示例）</th><th>主要手段</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in CRITICAL_STAGES" :key="row.stage">
                            <td class="stage">{{ row.stage }}</td>
                            <td class="mono">{{ row.budget }}</td>
                            <td>{{ row.note }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="CRITICAL_CODE" lang="html" title="只让关键资源进入首屏" />
        </DocSection>

        <DocSection id="bundle" title="打包体积" kicker="02 · BUNDLE">
            <p class="body-text">
                构建产物不是黑盒。先知道每个 chunk 属于谁、有多大、为什么在首屏，
                才能决定是拆包、替换依赖还是延后加载。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>产物分组</th><th>内容</th><th>策略</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in BUNDLE_GROUPS" :key="row.group">
                            <td class="mono">{{ row.group }}</td>
                            <td>{{ row.content }}</td>
                            <td>{{ row.strategy }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <Callout type="tip" title="体积问题的常见来源">
                同一个依赖被打进多个分包、整库引入图标 / 工具函数、
                首屏引入重型编辑器或图表库。先用分析工具定位，再决定换库或懒加载。
            </Callout>
            <p class="body-text">
                详细的产物分析与检查单见
                <NuxtLink to="/performance/bundle" class="inline-link">构建分析</NuxtLink>。
            </p>
        </DocSection>

        <DocSection id="lazy" title="懒加载与代码分割" kicker="03 · LAZY">
            <p class="body-text">
                懒加载的本质是把“下载 + 解析 + 水合”推迟到真正需要时。
                它适合交互后才出现的重组件、低频弹窗与富文本编辑器；
                首屏关键组件被懒加载，只会让用户看到内容却点不动。
            </p>
            <CodeBlock :code="LAZY_CODE" lang="vue" title="Lazy 前缀与 defineAsyncComponent" />
            <p class="body-text">
                可交互示例与体积对照见
                <NuxtLink to="/performance/lazy" class="inline-link">组件懒加载</NuxtLink>。
            </p>
        </DocSection>

        <DocSection id="prefetch" title="数据预取与缓存" kicker="04 · PREFETCH & CACHE">
            <p class="body-text">
                预取是把“用户下一步可能需要的资源”提前准备，缓存是把“已经拿到的结果”复用。
                两者都降低等待时间，但预取会增加带宽，缓存会引入一致性风险，需要按内容性质选择。
            </p>
            <CodeBlock :code="PREFETCH_CODE" lang="ts" title="路由预取与数据预取" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>缓存层</th><th>配置</th><th>适用内容</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in CACHE_ROWS" :key="row.layer">
                            <td class="stage">{{ row.layer }}</td>
                            <td class="mono">{{ row.header }}</td>
                            <td>{{ row.fit }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p class="body-text">
                水合成本与预取矩阵见
                <NuxtLink to="/performance/hydration" class="inline-link">水合与预取</NuxtLink>。
            </p>
        </DocSection>

        <DocSection id="checklist" title="优化检查单" kicker="05 · CHECKLIST">
            <ul class="checklist">
                <li v-for="item in CHECKLIST" :key="item">{{ item }}</li>
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

.inline-link {
    color: var(--accent);
    border-bottom: 1px dashed var(--accent);
}

.stage {
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
