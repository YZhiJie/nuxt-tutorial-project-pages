<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const VARIANTS = {
    midnight: { label: 'Midnight', accent: '#4ea8ff', bg: '#0a0a0c', text: '#e9eaee' },
    ocean: { label: 'Ocean', accent: '#22d3ee', bg: '#04121a', text: '#e3fbff' },
    sunset: { label: 'Sunset', accent: '#ffb020', bg: '#150a04', text: '#ffeede' },
} as const;

type VariantKey = keyof typeof VARIANTS;

const variant = ref<VariantKey>('midnight');
const variantKeys = Object.keys(VARIANTS) as VariantKey[];
const current = computed(() => VARIANTS[variant.value]);

const LAYERS_CODE = `/* 原始层：只描述值 */
:root {
    --blue-500: #4ea8ff;
    --violet-500: #7c6cff;
    --cyan-500: #22d3ee;
}

/* 语义层：只描述用途，组件唯一消费入口 */
:root {
    --accent: var(--blue-500);
    --surface: #121317;
    --text: #e9eaee;
}`;

const SEPARATION_CODE = `/* 组件层变量：只服务于这个组件，值来自语义层 */
.example-card {
    --card-bg: var(--surface);
    --card-text: var(--text);
    --card-accent: var(--accent);
}

.example-card {
    background: var(--card-bg);
    color: var(--card-text);
}

.example-card .cta {
    background: var(--card-accent);
}

/* 换肤时只覆盖 --card-accent，组件本身不需要改一行 */`;

const SCOPE_CODE = `/* 局部换肤：变量声明在容器上，只影响该子树 */
.token-stage[data-variant='midnight'] {
    --stage-bg: #0a0a0c;
    --stage-surface: #121317;
    --stage-text: #e9eaee;
    --stage-accent: #4ea8ff;
}

/* 模板里只切换 data-variant，不改变组件结构 */
/* <div class="token-stage" data-variant="ocean"> … </div> */`;

const mistakes = [
    '在组件里写死 #4ea8ff：换肤只能靠全局搜索替换，必然漏改。',
    '语义 token 命名带颜色（--blue-primary）：一旦换色，名字就开始说谎。',
    '把品牌色直接用于状态（成功 / 错误）：状态色需要独立语义与对比度。',
    '在多个容器上重复定义同一套主题变量：抽成公共选择器，避免漂移。',
    '只改背景不改文字：亮色主题下文字对比度不足，必须先改语义层再验证。',
];
</script>

<template>
    <DocPage
        title="设计 Token"
        description="Token 的价值在于“换一套变量就能换一套皮肤”。本页在同一容器上切换 3 套主题变量，组件本身不改一行代码。"
        :tags="['Design Token', 'CSS 变量', '多主题', '组件层']"
    >
        <DocSection id="layers" title="语义层与组件层分离" kicker="01 · TOKEN">
            <p class="body-text">
                原始层保存具体颜色值，语义层描述用途，组件层是组件私有的中间变量。
                组件只认组件层与语义层，永远不直接引用原始值。
            </p>
            <CodeBlock :code="LAYERS_CODE" lang="css" title="原始层与语义层" />
            <CodeBlock :code="SEPARATION_CODE" lang="css" title="组件层变量" />
        </DocSection>

        <DocSection id="scope" title="局部作用域换肤" kicker="02 · SCOPE">
            <p class="body-text">
                CSS 变量遵循作用域规则：声明在容器上，只对该容器及其后代生效。
                因此可以在一个页面内并排展示多套主题，而不影响全站。
                这正是下面演示的实现方式。
            </p>
            <CodeBlock :code="SCOPE_CODE" lang="css" title="容器级主题" />
            <Callout type="tip" title="主题 = 变量快照">
                主题本质上是一组变量值。切换主题不需要重新挂载组件，
                只需要改变承载变量的元素属性。
            </Callout>
        </DocSection>

        <DocSection id="demo" title="三套主题实时切换" kicker="03 · LIVE">
            <p class="body-text">
                下面容器的背景、卡片、文字与按钮全部消费 <code>--stage-*</code> 变量。
                点击按钮只改变容器上的 <code>data-variant</code>，组件结构与逻辑完全不变。
            </p>
            <DemoCard
                title="局部主题舞台"
                desc="midnight / ocean / sunset 三套变量，切换仅改变容器属性。"
                badge="LIVE"
            >
                <div class="variant-switch">
                    <button
                        v-for="key in variantKeys"
                        :key="key"
                        class="btn btn--sm"
                        :class="{ 'btn--ghost': variant !== key }"
                        type="button"
                        @click="variant = key"
                    >
                        {{ VARIANTS[key].label }}
                    </button>
                </div>

                <div class="token-stage" :data-variant="variant">
                    <div class="stage-card">
                        <p class="stage-eyebrow">THEME PREVIEW</p>
                        <h3 class="stage-title">{{ current.label }} 主题</h3>
                        <p class="stage-text">
                            这段文字使用 <code>--stage-text</code>，卡片背景使用
                            <code>--stage-surface</code>，边框使用 <code>--stage-line</code>。
                            组件本身没有任何颜色常量。
                        </p>
                        <div class="stage-actions">
                            <button class="stage-btn" type="button">主按钮</button>
                            <button class="stage-btn stage-btn--ghost" type="button">次按钮</button>
                        </div>
                        <div class="stage-swatches">
                            <span class="swatch">
                                <span class="swatch-dot" :style="{ background: current.accent }" />
                                <span class="swatch-name">--stage-accent</span>
                                <span class="swatch-value mono">{{ current.accent }}</span>
                            </span>
                            <span class="swatch">
                                <span class="swatch-dot" :style="{ background: current.bg }" />
                                <span class="swatch-name">--stage-bg</span>
                                <span class="swatch-value mono">{{ current.bg }}</span>
                            </span>
                            <span class="swatch">
                                <span class="swatch-dot" :style="{ background: current.text }" />
                                <span class="swatch-name">--stage-text</span>
                                <span class="swatch-value mono">{{ current.text }}</span>
                            </span>
                        </div>
                    </div>
                </div>

                <template #footer>
                    当前容器属性：<code class="mono">data-variant="{{ variant }}"</code>；变量作用域仅限这张 DemoCard。
                </template>
            </DemoCard>
        </DocSection>

        <DocSection id="mistakes" title="常见错误" kicker="04 · ANTI-PATTERN">
            <ul class="checklist">
                <li v-for="item in mistakes" :key="item">{{ item }}</li>
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

.variant-switch {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.token-stage {
    --stage-bg: #0a0a0c;
    --stage-surface: #121317;
    --stage-text: #e9eaee;
    --stage-muted: #a2a6b0;
    --stage-line: #24262d;
    --stage-accent: #4ea8ff;
    --stage-accent-soft: rgba(78, 168, 255, 0.14);

    margin-top: 14px;
    padding: 16px;
    border: 1px solid var(--stage-line);
    border-radius: var(--radius);
    background: var(--stage-bg);
    transition: background 200ms ease, border-color 200ms ease;
}

.token-stage[data-variant='ocean'] {
    --stage-bg: #04121a;
    --stage-surface: #082433;
    --stage-text: #e3fbff;
    --stage-muted: #8fc4d4;
    --stage-line: #164456;
    --stage-accent: #22d3ee;
    --stage-accent-soft: rgba(34, 211, 238, 0.14);
}

.token-stage[data-variant='sunset'] {
    --stage-bg: #150a04;
    --stage-surface: #241207;
    --stage-text: #ffeede;
    --stage-muted: #c9a184;
    --stage-line: #4d2a12;
    --stage-accent: #ffb020;
    --stage-accent-soft: rgba(255, 176, 32, 0.16);
}

.stage-card {
    padding: 16px;
    border: 1px solid var(--stage-line);
    border-radius: var(--radius-sm);
    background: var(--stage-surface);
}

.stage-eyebrow {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.16em;
    color: var(--stage-accent);
}

.stage-title {
    margin: 4px 0 8px;
    font-size: 18px;
    color: var(--stage-text);
}

.stage-text {
    margin: 0 0 14px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--stage-muted);
}

.stage-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.stage-btn {
    padding: 8px 14px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: var(--stage-accent);
    color: #0a0a0c;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
}

.stage-btn--ghost {
    background: transparent;
    border-color: var(--stage-line);
    color: var(--stage-text);
}

.stage-swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
}

.swatch {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 9px;
    border: 1px solid var(--stage-line);
    border-radius: 999px;
    font-size: 10px;
    color: var(--stage-muted);
}

.swatch-dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
}

.swatch-value {
    color: var(--stage-text);
    font-size: 10px;
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
    color: var(--text-muted);
    line-height: 1.7;
}

.checklist li::before {
    content: '×';
    position: absolute;
    left: 0;
    top: 0;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: rgba(248, 113, 113, 0.15);
    color: var(--danger);
    font-family: var(--font-mono);
    font-size: 11px;
}
</style>
