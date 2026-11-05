<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const visible = ref(false);
const loadCount = ref(0);

function toggle() {
    visible.value = !visible.value;
    if (visible.value) loadCount.value += 1;
}

const LAZY_CODE = `// Nuxt 自动为每个组件注册 Lazy 前缀版本，无需手动 import
<LazyDemoHeavyPanel v-if="visible" :density="6" />

// 首次渲染时才下载对应 chunk，之后的渲染直接复用
// 初始 v-if="false" 时，SSR 与首屏都不会包含该组件`;

const ASYNC_CODE = `import { defineAsyncComponent } from 'vue';

// 需要延迟展示、超时与错误兜底时使用显式 API
const HeavyPanel = defineAsyncComponent({
    loader: () => import('~/components/demo/DemoHeavyPanel.vue'),
    delay: 200,          // 200ms 内完成则不显示 loading
    timeout: 3000,       // 超时视为失败
    suspensible: false,  // 是否交给 <Suspense> 托管
    onError(error, retry, fail, attempts) {
        if (attempts <= 2) retry();
        else fail();
    },
});

// 组件中按需渲染
<component :is="HeavyPanel" v-if="visible" />`;

const HYDRATION_CODE = `// SSR 会渲染组件 HTML，但 chunk 仍需在客户端加载后才能水合
// 因此：首屏必需的重组件不要 Lazy；交互后才出现的组件优先 Lazy

// ✅ 交互后才出现
<LazyDemoHeavyPanel v-if="visible" />

// ⚠️ 首屏必需：Lazy 会推迟水合，反而拉长可交互时间
<LazyDemoHeavyPanel v-if="true" />

// 客户端专属的重组件可用 ClientOnly 包裹
<ClientOnly>
    <LazyDemoHeavyPanel />
</ClientOnly>`;

const TIPS = [
    'Lazy 组件的 chunk 在首次渲染前才下载；初始不渲染时，SSR 输出中不会出现它的 HTML。',
    '首屏关键内容不要 Lazy，推迟水合会让按钮长时间不可交互。',
    '重组件内部避免依赖父组件的响应式大对象，减少水合时的序列化与 diff 成本。',
    '用 <ClientOnly> 包裹纯客户端组件时，记得提供 loading 插槽，避免布局跳动。',
];
</script>

<template>
    <DocPage
        title="异步与懒加载组件"
        description="Lazy 前缀让组件按需加载并自动代码分割。理解 chunk 下载、SSR HTML 与客户端水合的关系，才能把懒加载用在正确的位置。"
        :tags="['Lazy 前缀', 'defineAsyncComponent', '代码分割', 'hydration', 'ClientOnly']"
    >
        <DocSection id="lazy" title="Lazy 前缀" kicker="01 · LAZY">
            <p class="body-text">
                Nuxt 会为 <code>app/components/</code> 下的每个组件自动注册一个
                <code>Lazy</code> 前缀版本。使用 <code>&lt;LazyDemoHeavyPanel /&gt;</code>
                时，组件代码被拆成独立 chunk，只有真正渲染时才下载。
            </p>
            <CodeBlock :code="LAZY_CODE" lang="vue" title="一行启用懒加载" />
            <DemoCard title="按需加载重型面板" desc="面板默认不渲染；点击后下载 chunk 并挂载。" badge="LIVE">
                <div class="async-toolbar">
                    <button type="button" class="btn" @click="toggle">
                        {{ visible ? '卸载面板' : '加载 DemoHeavyPanel' }}
                    </button>
                    <span class="async-meta mono">
                        mounted {{ loadCount }} 次 · {{ visible ? '已渲染' : '未渲染' }}
                    </span>
                </div>

                <div v-if="!visible" class="async-placeholder">
                    <span class="mono">&lt;LazyDemoHeavyPanel /&gt;</span>
                    <p>组件尚未渲染，对应 chunk 也尚未下载。</p>
                </div>

                <LazyDemoHeavyPanel v-else :density="6" />
            </DemoCard>
        </DocSection>

        <DocSection id="async-component" title="defineAsyncComponent" kicker="02 · ASYNC API">
            <p class="body-text">
                当需要延迟展示 loading、设置超时或失败重试时，用
                <code>defineAsyncComponent</code> 显式控制。
                它比 Lazy 前缀多一层策略，但需要自己管理加载状态。
            </p>
            <CodeBlock :code="ASYNC_CODE" lang="ts" title="显式异步组件的完整配置" />
            <Callout type="tip" title="什么时候选哪个">
                只是“按需渲染”就用 <code>Lazy</code> 前缀；
                需要 loading 延迟、超时、重试与错误组件时，才用 <code>defineAsyncComponent</code>。
            </Callout>
        </DocSection>

        <DocSection id="hydration" title="水合边界" kicker="03 · HYDRATION">
            <p class="body-text">
                懒加载影响的不只是下载体积，还有水合时机。SSR 可以输出组件 HTML，
                但事件绑定必须等 chunk 下载并执行后才生效。
                首屏关键组件被 Lazy 化，用户会看到内容却点不动。
            </p>
            <CodeBlock :code="HYDRATION_CODE" lang="ts" title="Lazy 与水合的关系" />
            <ul class="checklist">
                <li v-for="item in TIPS" :key="item">{{ item }}</li>
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

.async-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 14px;
}

.async-meta {
    font-size: 11px;
    color: var(--text-muted);
}

.async-placeholder {
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

.async-placeholder p {
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
