<script setup lang="ts">
import { MODULES, MODULE_COUNT, PAGE_COUNT } from '#shared/knowledge/modules';

const appConfig = useAppConfig();
const query = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

useSeoMeta({
    title: 'Nuxt 企业工程练功房 · 20 个可运行的企业级知识模块',
    description:
        '覆盖路由、渲染、数据、状态、认证、安全、可观测性、性能、SEO、国际化、PWA、实时、AI、全栈、测试、主题、无障碍与部署的 Nuxt 4 企业级知识库。',
    ogTitle: 'Nuxt 企业工程练功房',
    ogDescription: '20 个业务模块、60+ 页面，原理 + 可交互演示 + 常见坑，全部中文注释。',
    ogType: 'website',
});

const stats = [
    { value: String(MODULE_COUNT), label: '知识模块' },
    { value: String(PAGE_COUNT), label: '可访问页面' },
    { value: String(MODULES.reduce((n, m) => n + m.demos.filter((d) => d.kind === 'live').length, 0)), label: '实时演示' },
    { value: '4', label: '测试层级' },
];

const commands = [
    { label: '启动开发', cmd: 'pnpm dev', hint: 'http://localhost:3000' },
    { label: '类型检查', cmd: 'pnpm typecheck', hint: 'vue-tsc 全量检查' },
    { label: '单元测试', cmd: 'pnpm test', hint: 'Vitest 纯函数与工具' },
    { label: '生产构建', cmd: 'pnpm build', hint: 'Nitro 服务端产物' },
];

const learningPath = [
    { step: '01', title: '框架地基', desc: '路由、渲染、数据获取、状态管理' },
    { step: '02', title: '平台能力', desc: '组件体系、表单、认证、安全、可观测性' },
    { step: '03', title: '体验工程', desc: '性能、SEO、国际化、PWA、实时通信' },
    { step: '04', title: '企业交付', desc: '全栈数据层、测试、主题、无障碍、部署' },
];

const filteredModules = computed(() => {
    const keyword = query.value.trim().toLowerCase();
    if (!keyword) return MODULES;
    return MODULES.filter((mod) => {
        const haystack = [
            mod.title,
            mod.brief,
            mod.goal,
            ...mod.demos.map((demo) => `${demo.name} ${demo.desc}`),
        ]
            .join(' ')
            .toLowerCase();
        return haystack.includes(keyword);
    });
});

// 键盘快捷键：斜杠聚焦搜索框
function onKeydown(event: KeyboardEvent) {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    event.preventDefault();
    inputRef.value?.focus();
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
    <div class="home">
        <section class="hero">
            <div class="container hero-inner">
                <div class="hero-copy">
                    <p class="eyebrow">NUXT 4 · VUE 3.5 · NITRO</p>
                    <h1>
                        把企业级 Nuxt 工程<br />
                        拆成 <span class="accent">可运行的知识模块</span>
                    </h1>
                    <p class="lead">
                        20 个业务域、60+ 个页面，从文件路由到多租户订单状态机。
                        每个模块都配原理、可交互演示、常见坑与落地清单，全部中文注释。
                    </p>
                    <div class="hero-actions">
                        <a href="#modules" class="btn">浏览模块</a>
                        <NuxtLink to="/routing" class="btn btn--ghost">从路由开始</NuxtLink>
                        <a :href="appConfig.repoUrl" class="hero-link" target="_blank" rel="noopener noreferrer">
                            GitHub ↗
                        </a>
                    </div>

                    <dl class="stats">
                        <div v-for="item in stats" :key="item.label" class="stat">
                            <dt>{{ item.value }}</dt>
                            <dd>{{ item.label }}</dd>
                        </div>
                    </dl>
                </div>

                <aside class="hero-side">
                    <div class="terminal">
                        <div class="terminal-bar">
                            <span class="dot dot--red" />
                            <span class="dot dot--yellow" />
                            <span class="dot dot--green" />
                            <span class="terminal-title mono">quick start</span>
                        </div>
                        <div class="terminal-body mono">
                            <p><span class="prompt">$</span> pnpm install</p>
                            <p><span class="prompt">$</span> pnpm dev</p>
                            <p class="terminal-out">→ Local: http://localhost:3000</p>
                            <p class="terminal-out">→ Nitro server + Vue SSR ready</p>
                            <p class="terminal-out">→ 20 modules loaded</p>
                        </div>
                    </div>
                    <div class="hero-note">
                        <p class="mono faint">TECH STACK</p>
                        <p>Nuxt 4 · Vue 3.5 · Pinia · TypeScript · Vitest · Nitro KV</p>
                    </div>
                </aside>
            </div>
        </section>

        <section id="modules" class="modules-section">
            <div class="container">
                <div class="section-head">
                    <div>
                        <p class="eyebrow">KNOWLEDGE MAP</p>
                        <h2 class="h2">知识地图</h2>
                        <p class="muted">按业务域组织，点击进入模块总览；每个子页面都对应一个可运行示例。</p>
                    </div>
                    <label class="search">
                        <span class="search-icon" aria-hidden="true">⌕</span>
                        <input
                            ref="inputRef"
                            v-model="query"
                            type="search"
                            class="input search-input"
                            placeholder="搜索模块、页面或知识点（按 / 聚焦）"
                            aria-label="搜索知识模块"
                        />
                    </label>
                </div>

                <p class="result-line">
                    展示 <strong>{{ filteredModules.length }}</strong> / {{ MODULES.length }} 个模块
                    <span v-if="query" class="faint">· 关键字「{{ query }}」</span>
                </p>

                <div v-if="filteredModules.length" class="grid">
                    <ModuleCard
                        v-for="(mod, index) in filteredModules"
                        :key="mod.key"
                        :module="mod"
                        :index="index"
                    />
                </div>
                <div v-else class="empty">
                    <p>没有匹配的模块。</p>
                    <button class="btn btn--ghost btn--sm" @click="query = ''">清除搜索</button>
                </div>
            </div>
        </section>

        <section class="path-section">
            <div class="container">
                <p class="eyebrow">LEARNING PATH</p>
                <h2 class="h2">按交付链路学习</h2>
                <div class="path-grid">
                    <div v-for="item in learningPath" :key="item.step" class="path-card">
                        <span class="path-step mono">{{ item.step }}</span>
                        <h3>{{ item.title }}</h3>
                        <p class="muted">{{ item.desc }}</p>
                    </div>
                </div>
            </div>
        </section>

        <section class="run-section">
            <div class="container">
                <p class="eyebrow">RUN LOCALLY</p>
                <h2 class="h2">怎么跑起来</h2>
                <p class="muted">依赖已内置，装好 pnpm 后即可启动；数据库与缓存类示例会使用 Nitro 内存 / 文件存储自动降级。</p>
                <div class="run-grid">
                    <div v-for="(item, index) in commands" :key="item.cmd" class="run-card">
                        <p class="run-index mono">{{ String(index + 1).padStart(2, '0') }} · {{ item.label }}</p>
                        <p class="run-cmd mono">{{ item.cmd }}</p>
                        <p class="faint">{{ item.hint }}</p>
                    </div>
                </div>
                <p class="run-note muted">
                    每个模块目录均含 README.md，讲原理、要点与常见坑。
                    <a href="#modules" class="back-top">回到知识地图 ↑</a>
                </p>
            </div>
        </section>
    </div>
</template>

<style scoped>
.home {
    padding-bottom: 40px;
}

/* ===== Hero ===== */
.hero {
    padding: 72px 0 56px;
    border-bottom: 1px solid var(--line);
    background:
        radial-gradient(760px 360px at 82% 8%, var(--glow-pink), transparent 65%),
        radial-gradient(620px 320px at 8% 100%, var(--glow-cyan), transparent 62%),
        linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.18));
}

.hero-inner {
    display: grid;
    grid-template-columns: 1.25fr 0.9fr;
    gap: 48px;
    align-items: center;
}

.hero-copy h1 {
    margin: 14px 0 18px;
    font-size: clamp(32px, 4.6vw, 52px);
    line-height: 1.14;
    letter-spacing: -0.03em;
}

.accent {
    background: var(--gradient-neon);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
}

.hero-actions {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    margin-top: 26px;
}

.hero-link {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-muted);
    border-bottom: 1px dashed var(--line-strong);
    padding-bottom: 2px;
}

.hero-link:hover {
    color: var(--accent);
    border-color: var(--accent);
}

.stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin: 40px 0 0;
}

.stat {
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
}

.stat dt {
    font-family: var(--font-mono);
    font-size: 24px;
    font-weight: 700;
    color: var(--accent);
}

.stat dd {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--text-faint);
}

/* ===== 终端卡片 ===== */
.hero-side {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.terminal {
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--bg-elevated);
    box-shadow: var(--shadow);
}

.terminal-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 9px 12px;
    border-bottom: 1px solid var(--line);
    background: var(--surface-2);
}

.dot {
    width: 9px;
    height: 9px;
    border-radius: 999px;
}

.dot--red {
    background: #ff5f57;
}

.dot--yellow {
    background: #febc2e;
}

.dot--green {
    background: #28c840;
}

.terminal-title {
    margin-left: 8px;
    font-size: 10px;
    color: var(--text-faint);
}

.terminal-body {
    padding: 18px 16px;
    font-size: 12.5px;
    line-height: 1.9;
}

.terminal-body p {
    margin: 0;
}

.prompt {
    color: var(--accent);
    margin-right: 6px;
}

.terminal-out {
    color: var(--text-faint);
}

.hero-note {
    padding: 14px 16px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface-2);
    font-size: 12px;
}

.hero-note p {
    margin: 0;
}

.hero-note .mono {
    margin-bottom: 4px;
    letter-spacing: 0.12em;
    font-size: 10px;
}

/* ===== 模块区 ===== */
.modules-section {
    padding: 56px 0;
}

.section-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
    margin-bottom: 18px;
}

.section-head h2 {
    margin-top: 4px;
}

.search {
    position: relative;
    width: min(380px, 100%);
}

.search-icon {
    position: absolute;
    left: 13px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-faint);
    font-size: 16px;
}

.search-input {
    padding-left: 36px;
}

.result-line {
    margin: 0 0 18px;
    font-size: 12px;
    color: var(--text-muted);
}

.result-line strong {
    color: var(--accent);
}

.empty {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 32px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius);
    color: var(--text-muted);
}

.empty p {
    margin: 0;
}

/* ===== 学习路径 ===== */
.path-section {
    padding: 46px 0;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    background: var(--surface);
}

.path-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 14px;
    margin-top: 20px;
}

.path-card {
    padding: 20px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-elevated);
}

.path-step {
    font-size: 11px;
    color: var(--accent);
    letter-spacing: 0.1em;
}

.path-card h3 {
    margin: 8px 0 4px;
    font-size: 16px;
}

.path-card p {
    margin: 0;
    font-size: 13px;
}

/* ===== 运行 ===== */
.run-section {
    padding: 56px 0 20px;
}

.run-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 14px;
    margin-top: 20px;
}

.run-card {
    padding: 18px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
}

.run-index {
    margin: 0;
    font-size: 10px;
    letter-spacing: 0.08em;
    color: var(--text-faint);
}

.run-cmd {
    margin: 8px 0 4px;
    font-size: 15px;
    color: var(--accent);
}

.run-card p:last-child {
    margin: 0;
    font-size: 12px;
}

.run-note {
    margin-top: 26px;
    font-size: 13px;
}

.back-top {
    margin-left: 8px;
    color: var(--text);
    border-bottom: 1px solid var(--line-strong);
}

@media (max-width: 900px) {
    .hero-inner {
        grid-template-columns: 1fr;
        gap: 32px;
    }

    .stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .hero {
        padding-top: 44px;
    }
}
</style>
