<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const visible = ref(false);
const renderCount = ref(0);

function toggle() {
    visible.value = !visible.value;
    if (visible.value) renderCount.value += 1;
}

const LAZY_CODE = `// Nuxt 为 components/ 下每个组件自动注册 Lazy 前缀版本
<LazyDemoPerfHeavyPanel v-if="visible" :rows="12" />

// 首次渲染时才下载对应 chunk；之后复用同一个组件实例逻辑
// v-if 为 false 时，该组件不会出现在 SSR 输出里，也不占用首屏 JS`;

const ASYNC_CODE = `import { defineAsyncComponent } from 'vue';

// 需要 loading 延迟、超时与失败重试时使用显式 API
const HeavyPanel = defineAsyncComponent({
    loader: () => import('~/components/demo/perf/DemoPerfHeavyPanel.vue'),
    delay: 200,          // 200ms 内加载完成则不显示 loading
    timeout: 3000,       // 超过 3 秒视为失败
    suspensible: false,  // 是否交给 <Suspense> 托管
    onError(error, retry, fail, attempts) {
        if (attempts <= 2) retry();
        else fail();
    },
});

// 模板中按需渲染
<component :is="HeavyPanel" v-if="visible" />`;

const HYDRATION_CODE = `// SSR 会输出组件 HTML，但事件绑定要等客户端 chunk 下载并执行
// 因此：首屏必需的重组件不要 Lazy；交互后才出现的组件优先 Lazy

// ✅ 交互后才出现
<LazyDemoPerfHeavyPanel v-if="visible" />

// ⚠️ 首屏必需：Lazy 会推迟水合，用户看得到却点不动
<LazyDemoPerfHeavyPanel v-if="true" />

// 纯客户端重组件可用 ClientOnly 明确边界
<ClientOnly>
    <LazyDemoPerfHeavyPanel />
    <template #fallback>加载中…</template>
</ClientOnly>`;

const BENEFITS = [
    '初始 JS 更小：重组件及其依赖从首屏 chunk 中拆出，只在需要时下载。',
    '解析与执行成本后移：减少首屏主线程工作，降低阻塞交互的时间。',
    '缓存更细：组件 chunk 带内容哈希，版本不变时可持续命中浏览器缓存。',
    '代价是首次交互多一次网络往返：高频首屏功能不适合懒加载。',
];

const DECISION = [
    '首屏可见、用户马上要操作的内容：不要 Lazy。',
    '弹窗、侧边栏、富文本编辑器、图表详情：优先 Lazy。',
    '需要加载态与失败重试：用 defineAsyncComponent。',
    '完全依赖浏览器 API（如 canvas、WebGL）的组件：外层包 ClientOnly。',
];
</script>

<template>
    <DocPage
        title="组件懒加载"
        description="懒加载把重组件从首屏链路中移出：代码分割成独立 chunk，只在真正渲染时下载与执行。理解 Lazy 前缀、异步组件配置与水合边界，才能既减体积又不伤体验。"
        :tags="['Lazy 前缀', 'defineAsyncComponent', '代码分割', '水合边界', 'ClientOnly']"
    >
        <DocSection id="lazy" title="Lazy 前缀：零配置代码分割" kicker="01 · LAZY">
            <p class="body-text">
                Nuxt 会为 <code>app/components/</code> 下每个组件自动注册
                <code>Lazy</code> 前缀版本。写 <code>&lt;LazyDemoPerfHeavyPanel /&gt;</code>
                时，组件代码被拆成独立 chunk，只有真正渲染时才下载。
                本页的重组件位于 <code>app/components/demo/perf/DemoPerfHeavyPanel.vue</code>，
                文件名带 Perf 前缀，避免与已有组件同名注册冲突。
            </p>
            <CodeBlock :code="LAZY_CODE" lang="vue" title="一行启用按需加载" />

            <DemoCard
                title="按需加载重型面板"
                desc="面板默认不渲染；点击后下载 chunk，再挂载 12×10 的数据网格。"
                badge="LIVE"
            >
                <div class="lazy-toolbar">
                    <button type="button" class="btn" @click="toggle">
                        {{ visible ? '卸载面板' : '加载 DemoPerfHeavyPanel' }}
                    </button>
                    <span class="lazy-meta mono">
                        mounted {{ renderCount }} 次 · {{ visible ? '已渲染' : '未渲染' }}
                    </span>
                </div>

                <div v-if="!visible" class="lazy-placeholder">
                    <span class="mono">&lt;LazyDemoPerfHeavyPanel /&gt;</span>
                    <p>组件尚未渲染，对应 chunk 也尚未下载。</p>
                </div>

                <LazyDemoPerfHeavyPanel v-else :rows="12" />
            </DemoCard>

            <Callout type="tip" title="打开网络面板观察差异">
                首次点击前，DevTools 的网络列表里没有
                <code>DemoPerfHeavyPanel</code> 的 chunk；点击后才出现一次 JS 请求。
                这就是“按需加载”最直接的证据。
            </Callout>
        </DocSection>

        <DocSection id="async-component" title="defineAsyncComponent：需要策略时" kicker="02 · ASYNC API">
            <p class="body-text">
                Lazy 前缀只负责“按需渲染”。当需要 loading 延迟、超时、失败重试，
                或者要把异步组件交给 <code>&lt;Suspense&gt;</code> 管理时，
                用 <code>defineAsyncComponent</code> 显式声明。
            </p>
            <CodeBlock :code="ASYNC_CODE" lang="ts" title="异步组件的完整配置" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>选项</th><th>作用</th><th>建议</th></tr>
                    </thead>
                    <tbody>
                        <tr><td class="mono">loader</td><td>返回组件 Promise</td><td>用动态 import，保持代码分割</td></tr>
                        <tr><td class="mono">delay</td><td>多久后才显示 loading</td><td>200ms 左右，避免闪烁</td></tr>
                        <tr><td class="mono">timeout</td><td>多久判定失败</td><td>结合网络与组件体积设 3–5 秒</td></tr>
                        <tr><td class="mono">suspensible</td><td>是否交给 Suspense</td><td>独立 loading 时设为 false</td></tr>
                        <tr><td class="mono">onError</td><td>重试或失败兜底</td><td>最多重试 1–2 次，之后展示错误态</td></tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="hydration" title="水合边界与收益" kicker="03 · HYDRATION">
            <p class="body-text">
                懒加载影响的不只是下载体积，还有水合时机。SSR 可以输出组件 HTML，
                但事件绑定必须等 chunk 下载并执行后才生效。首屏关键组件被 Lazy 化，
                用户会看到内容却点不动。
            </p>
            <CodeBlock :code="HYDRATION_CODE" lang="ts" title="Lazy 与水合的关系" />
            <ul class="checklist">
                <li v-for="item in BENEFITS" :key="item">{{ item }}</li>
            </ul>
        </DocSection>

        <DocSection id="decision" title="决策清单" kicker="04 · DECISION">
            <ul class="plain-list">
                <li v-for="item in DECISION" :key="item">{{ item }}</li>
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

.lazy-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 14px;
}

.lazy-meta {
    font-size: 11px;
    color: var(--text-muted);
}

.lazy-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 36px 16px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface-2);
    color: var(--text-muted);
    text-align: center;
    font-size: 13px;
}

.lazy-placeholder p {
    margin: 0;
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
    line-height: 1.7;
    color: var(--text-muted);
}

.checklist li::before {
    content: '→';
    position: absolute;
    left: 0;
    color: var(--accent);
    font-family: var(--font-mono);
}

.plain-list {
    margin: 0;
    padding-left: 18px;
    font-size: 14px;
    line-height: 1.9;
    color: var(--text-muted);
}
</style>
