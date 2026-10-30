<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const API_CODE = `// 组件 API = props（输入）+ emits（输出）+ slots（结构扩展）
<script setup lang="ts">
const props = withDefaults(
    defineProps<{
        title: string;
        level?: 1 | 2 | 3;
        closable?: boolean;
    }>(),
    { level: 2, closable: false },
);

const emit = defineEmits<{
    close: [];
    confirm: [value: string];
}>();
<\/script>`;

const MODEL_CODE = `// 子组件遵循 v-model 契约：modelValue + update:modelValue
const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

// 父组件只写一行
<SearchBox v-model="keyword" />

// 等价展开
<SearchBox :model-value="keyword" @update:model-value="keyword = $event" />`;

const SLOT_CODE = `<!-- 三种插槽：默认、具名、作用域 -->
<template>
    <article class="card">
        <header class="card-head">
            <slot name="header" :title="title">
                <h3>{{ title }}</h3>
            </slot>
        </header>

        <div class="card-body">
            <slot />
        </div>

        <footer class="card-foot">
            <slot name="footer" :count="count" />
        </footer>
    </article>
</template>`;

const ASYNC_CODE = `// Nuxt 为每个组件自动注册 Lazy 前缀版本
<LazyDemoHeavyPanel v-if="visible" />

// 需要延迟、超时与错误兜底时，使用显式异步组件
const HeavyPanel = defineAsyncComponent({
    loader: () => import('~/components/demo/DemoHeavyPanel.vue'),
    delay: 200,
    timeout: 3000,
    suspensible: false,
});`;

const NAMING_CODE = `app/components/
├── docs/DocPage.vue                 → <DocPage />
├── docs/DocSection.vue              → <DocSection />
├── demo/DemoProfileCard.vue         → <DemoProfileCard />
├── demo/DemoFocusModal.vue          → <DemoFocusModal />
└── demo/perf/DemoPerfHeavyPanel.vue → <DemoPerfHeavyPanel />

// nuxt.config.ts: components: [{ path: '~/components', pathPrefix: false }]
// 目录只用于组织文件，组件名由文件名决定，因此文件名必须唯一`;

const principles = [
    'props 只接收数据，不在子组件里修改父组件传入的对象。',
    '事件名描述“已经发生的事实”（saved / closed），而不是模糊的 action。',
    '插槽用于结构扩展，不要用十几个布尔 props 模拟布局变体。',
    '副作用与数据请求放在页面或 composable，展示组件保持纯粹。',
];
</script>

<template>
    <DocPage
        title="组件体系"
        description="组件是团队的公共 API。统一的 props / emits / slots 契约、清晰的命名与自动导入规则，决定了组件能否被安全复用。"
        :tags="['Props', 'Emits', 'Slots', 'v-model', '异步组件', '自动导入']"
    >
        <DocSection id="api" title="Props / Emits / Slots" kicker="01 · API">
            <p class="body-text">
                一个组件的对外契约只有三部分：<code>props</code> 是输入，
                <code>emits</code> 是输出，<code>slots</code> 是结构扩展点。
                三者都应该有明确的类型与默认值。
            </p>
            <CodeBlock :code="API_CODE" lang="vue" title="类型化的组件契约" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>契约</th><th>方向</th><th>用途</th><th>约束</th></tr>
                    </thead>
                    <tbody>
                        <tr><td class="mono">props</td><td>父 → 子</td><td>数据与配置</td><td>只读，不直接修改</td></tr>
                        <tr><td class="mono">emits</td><td>子 → 父</td><td>通知与请求</td><td>命名表达已发生的事实</td></tr>
                        <tr><td class="mono">slots</td><td>父 → 子</td><td>结构扩展</td><td>默认 / 具名 / 作用域</td></tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="model" title="v-model 契约" kicker="02 · V-MODEL">
            <p class="body-text">
                <code>v-model</code> 本质上是一个语法糖：<code>modelValue</code> prop 加
                <code>update:modelValue</code> 事件。自定义表单组件只要遵守这个命名，
                就能被父组件以标准方式绑定。
            </p>
            <CodeBlock :code="MODEL_CODE" lang="vue" title="双向绑定的最小契约" />
            <Callout type="tip" title="子组件不持有真相">
                受控组件的值由父组件提供，子组件只发出“用户想改成什么”的意图。
                这样父组件可以校验、拦截或撤销每一次变更。
            </Callout>
        </DocSection>

        <DocSection id="slots" title="插槽的三种形态" kicker="03 · SLOTS">
            <p class="body-text">
                默认插槽承载主体内容，具名插槽承载固定区域，作用域插槽把子组件内部数据
                反向暴露给父组件——这是“结构由使用方决定”的关键。
            </p>
            <CodeBlock :code="SLOT_CODE" lang="vue" title="默认 / 具名 / 作用域" />
        </DocSection>

        <DocSection id="async" title="异步与懒加载组件" kicker="04 · ASYNC">
            <p class="body-text">
                Nuxt 会自动为每个组件生成 <code>Lazy</code> 前缀版本。
                <code>&lt;LazyXxx /&gt;</code> 在首次渲染时才加载对应 chunk，
                适合重型图表、编辑器与仅在交互后出现的面板。
            </p>
            <CodeBlock :code="ASYNC_CODE" lang="ts" title="Lazy 前缀与 defineAsyncComponent" />
        </DocSection>

        <DocSection id="naming" title="命名与自动导入" kicker="05 · NAMING">
            <p class="body-text">
                本项目在 <code>nuxt.config.ts</code> 中设置 <code>pathPrefix: false</code>，
                目录只用于组织文件，组件名直接来自文件名。因此<strong>文件名必须唯一</strong>，
                重名会导致自动导入冲突。
            </p>
            <CodeBlock :code="NAMING_CODE" lang="text" title="目录与组件名" />
            <ul class="checklist">
                <li v-for="item in principles" :key="item">{{ item }}</li>
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
