<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const { theme, ready, toggle, set } = useTheme();

const prefersLight = ref(false);

onMounted(() => {
    prefersLight.value = window.matchMedia('(prefers-color-scheme: light)').matches;
});

// 依赖 theme，切换后重新读取 html 上的真实属性
const htmlTheme = computed(() => {
    void theme.value;
    if (!import.meta.client) return '(SSR)';
    return document.documentElement.dataset.theme ?? '(未设置)';
});

const COMPOSABLE_CODE = `// app/composables/useTheme.ts
export type ThemeMode = 'dark' | 'light';
const STORAGE_KEY = 'nuxt-lab-theme';

export function useTheme() {
    // useState：SSR 与客户端共享同一份状态，避免水合不一致
    const theme = useState<ThemeMode>('theme-mode', () => 'dark');
    const ready = useState('theme-ready', () => false);

    function apply(mode: ThemeMode) {
        if (!import.meta.client) return;
        document.documentElement.dataset.theme = mode;
        window.localStorage.setItem(STORAGE_KEY, mode);
    }

    function toggle() {
        theme.value = theme.value === 'dark' ? 'light' : 'dark';
        apply(theme.value);
    }

    function set(mode: ThemeMode) {
        theme.value = mode;
        apply(mode);
    }

    return { theme, ready, toggle, set };
}`;

const PLUGIN_CODE = `// app/plugins/03.theme.client.ts
// 在首屏绘制前把主题写到 <html data-theme>，避免默认暗色闪一下再变亮
export default defineNuxtPlugin(() => {
    if (!import.meta.client) return;

    const stored = window.localStorage.getItem('nuxt-lab-theme');
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    document.documentElement.dataset.theme = stored ?? (prefersLight ? 'light' : 'dark');
});`;

const PERSIST_CODE = `// 持久化优先级：用户显式选择 > 系统偏好 > 默认值
const stored = localStorage.getItem('nuxt-lab-theme');
const prefersLight = matchMedia('(prefers-color-scheme: light)').matches;
const mode = stored ?? (prefersLight ? 'light' : 'dark');

// 系统偏好变化：仅在用户尚未显式选择时跟随
matchMedia('(prefers-color-scheme: light)').addEventListener('change', (event) => {
    if (localStorage.getItem('nuxt-lab-theme')) return;
    document.documentElement.dataset.theme = event.matches ? 'light' : 'dark';
});`;

const CSS_CODE = `/* 主题差异只发生在语义 token 上 */
:root {
    color-scheme: dark;
    --bg: #0a0a0c;
    --surface: #121317;
    --text: #e9eaee;
    --text-muted: #a2a6b0;
}

:root[data-theme='light'] {
    color-scheme: light;
    --bg: #f7f8fb;
    --surface: #ffffff;
    --text: #101623;
    --text-muted: #566072;
}`;

const checks = [
    '首屏闪烁：主题必须在第一次绘制前确定，插件或内联脚本都要早于水合。',
    '水合一致性：useState 持有主题，服务端与客户端首次渲染必须一致。',
    '持久化键名统一：读写只用一个常量，避免拼写漂移。',
    '系统偏好变化要监听，但用户显式选择后不再自动覆盖。',
    'color-scheme 同步设置，让原生滚动条与表单控件跟随主题。',
    '亮色主题下重新检查对比度：暗色下好看的颜色在亮色下可能不达标。',
];
</script>

<template>
    <DocPage
        title="暗色模式"
        description="暗色模式不是把背景改黑，而是两套经过对比度校验的语义 token。难点在首屏：主题必须在第一次绘制前确定，否则就会闪。"
        :tags="['useTheme', 'data-theme', '无闪烁', 'prefers-color-scheme', 'localStorage']"
    >
        <DocSection id="composable" title="useTheme：两层状态" kicker="01 · COMPOSABLE">
            <p class="body-text">
                主题有两个承载：Vue 侧的 <code>useState</code> 用于渲染与组件判断，
                DOM 侧的 <code>&lt;html data-theme&gt;</code> 用于 CSS 变量切换。
                两个都要更新，缺一个就会出现“组件认为是暗色、样式却是亮色”。
            </p>
            <CodeBlock :code="COMPOSABLE_CODE" lang="ts" title="app/composables/useTheme.ts" />
            <CodeBlock :code="CSS_CODE" lang="css" title="两套语义 token" />
        </DocSection>

        <DocSection id="fouc" title="首屏无闪烁" kicker="02 · NO FOUC">
            <p class="body-text">
                主题初始化必须在样式计算之前完成。本项目的做法是用客户端插件：
                它在 Nuxt 应用启动前读取 <code>localStorage</code> 与系统偏好，
                并把结果写到 <code>html.dataset.theme</code>。
            </p>
            <CodeBlock :code="PLUGIN_CODE" lang="ts" title="首屏主题插件" />
            <Callout type="warn" title="别在 onMounted 里初始化主题">
                <code>onMounted</code> 发生在首屏绘制之后，用它切换主题必然闪一下。
                初始化放插件或 <code>&lt;head&gt;</code> 内联脚本，水合后再做交互响应。
            </Callout>
        </DocSection>

        <DocSection id="preference" title="系统偏好与持久化" kicker="03 · PREFERENCE">
            <p class="body-text">
                默认值来自系统偏好，一旦用户点击过切换，就以本地存储为准。
                监听 <code>prefers-color-scheme</code> 的变化，但要先判断是否存在显式选择，
                否则会覆盖用户的决定。
            </p>
            <CodeBlock :code="PERSIST_CODE" lang="ts" title="优先级与变化监听" />
        </DocSection>

        <DocSection id="demo" title="切换并观察真实属性" kicker="04 · LIVE">
            <p class="body-text">
                按钮调用的是全站同一个 <code>useTheme()</code>，会同时更新
                <code>html[data-theme]</code> 与本地存储。切换后观察下方状态：
                属性值与 Vue 状态应保持一致。
            </p>
            <DemoCard
                title="主题切换"
                desc="改变的是 <html data-theme>，不是页面局部 class。"
                badge="LIVE"
            >
                <div class="theme-row">
                    <button class="btn" type="button" @click="toggle">
                        切换（当前 {{ theme }}）
                    </button>
                    <button class="btn btn--ghost" type="button" @click="set('dark')">强制暗色</button>
                    <button class="btn btn--ghost" type="button" @click="set('light')">强制亮色</button>
                </div>

                <div class="state-grid">
                    <div class="state">
                        <p class="state-name">Vue theme</p>
                        <p class="state-value mono">{{ theme }}</p>
                    </div>
                    <div class="state">
                        <p class="state-name">html[data-theme]</p>
                        <p class="state-value mono">{{ htmlTheme }}</p>
                    </div>
                    <div class="state">
                        <p class="state-name">系统偏好</p>
                        <p class="state-value mono">{{ prefersLight ? 'light' : 'dark' }}</p>
                    </div>
                    <div class="state">
                        <p class="state-name">初始化</p>
                        <p class="state-value mono">{{ ready ? 'ready' : 'pending' }}</p>
                    </div>
                </div>

                <div class="preview-card">
                    <p class="preview-title">语义 token 预览</p>
                    <p class="preview-text">
                        这张卡片只使用 <code>--surface</code>、<code>--text</code>、
                        <code>--line</code> 与 <code>--accent</code>，因此会自动跟随主题。
                    </p>
                    <span class="badge badge--accent">accent</span>
                </div>

                <template #footer>
                    主题写入 localStorage 的 <code>nuxt-lab-theme</code>；刷新页面后仍会保留。
                </template>
            </DemoCard>
        </DocSection>

        <DocSection id="checks" title="检查单" kicker="05 · CHECK">
            <ul class="checklist">
                <li v-for="item in checks" :key="item">{{ item }}</li>
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

.theme-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.state-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 10px;
    margin-top: 14px;
}

.state {
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
}

.state-name {
    margin: 0;
    font-size: 11px;
    color: var(--text-faint);
}

.state-value {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--accent);
}

.preview-card {
    margin-top: 14px;
    padding: 14px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface);
}

.preview-title {
    margin: 0 0 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
}

.preview-text {
    margin: 0 0 10px;
    font-size: 12px;
    line-height: 1.7;
    color: var(--text-muted);
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
