<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const LAYERS_CODE = `/* 1. 原始层 primitive：只描述值，不带用途 */
:root {
    --blue-500: #4ea8ff;
    --violet-500: #7c6cff;
    --cyan-500: #22d3ee;
    --ink-950: #0a0a0c;
}

/* 2. 语义层 semantic：描述用途，全站组件只认这一层 */
:root {
    --bg: var(--ink-950);
    --surface: #121317;
    --text: #e9eaee;
    --accent: var(--blue-500);
}

/* 3. 组件层 component：组件私有变量，值来自语义层 */
.card {
    --card-bg: var(--surface);
    --card-border: var(--line);
    background: var(--card-bg);
    border: 1px solid var(--card-border);
}`;

const THEME_CODE = `/* 模式层：亮 / 暗只负责明度与对比度 */
:root[data-theme='light'] {
    --bg: #f7f8fb;
    --surface: #ffffff;
    --text: #101623;
    --text-muted: #566072;
}

/* 品牌层：只覆盖强调色，不改变明暗 */
[data-brand='midnight'] { --accent: var(--blue-500); }
[data-brand='ocean'] { --accent: var(--cyan-500); }
[data-brand='violet'] { --accent: var(--violet-500); }

/* 两轴正交：4 种组合由 CSS 变量自动合成 */
/* <html data-theme="light" data-brand="ocean"> */`;

const CONSUMER_CODE = `/* 组件只消费语义 token，禁止写死颜色 */
.stat-card {
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--line);
}

.stat-card__value {
    color: var(--accent);
}

/* 反例：写死颜色后，暗色与多主题都会失效 */
/* .stat-card { background: #ffffff; color: #111111; } */`;

const layers = [
    { layer: '原始层', example: '--green-500 / --gray-950', owner: '设计系统维护者，业务代码不直接引用' },
    { layer: '语义层', example: '--bg / --surface / --text / --accent', owner: '设计系统维护者，组件唯一入口' },
    { layer: '组件层', example: '--card-bg / --button-bg', owner: '组件作者，在组件根节点声明' },
];

const rules = [
    '组件里禁止出现十六进制颜色与 rgba 常量；所有颜色必须来自语义 token。',
    '新增 token 先问「它描述用途还是描述值」：描述值放原始层，描述用途放语义层。',
    '暗色模式只改语义层，不改组件；组件不应感知当前是亮色还是暗色。',
    '强调色与状态色分离：accent 表达品牌，info/warn/danger 表达语义。',
    '对比度按 WCAG AA 校验：正文 ≥ 4.5:1，大字号 ≥ 3:1。',
    'token 命名用「用途 + 角色」，不要用颜色名（--blue-text 是反例）。',
];
</script>

<template>
    <DocPage
        title="主题与设计系统"
        description="设计系统的核心不是配色，而是分层：原始值、语义用途、组件私有变量。分好层，暗色模式与多主题只是覆盖变量的不同组合。"
        :tags="['Design Token', '语义层', '暗色模式', '多主题']"
    >
        <DocSection id="layers" title="Token 的三层结构" kicker="01 · LAYERS">
            <p class="body-text">
                直接写颜色值的组件无法换肤；只写语义 token 的组件天然支持主题。
                三层结构把「值」与「用途」分开：原始层可替换，语义层被组件消费，
                组件层只服务单个组件。
            </p>
            <CodeBlock :code="LAYERS_CODE" lang="css" title="primitive → semantic → component" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>层</th><th>示例</th><th>归属</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in layers" :key="row.layer">
                            <td>{{ row.layer }}</td>
                            <td class="mono">{{ row.example }}</td>
                            <td>{{ row.owner }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="orthogonal" title="暗色与多主题正交" kicker="02 · ORTHOGONAL">
            <p class="body-text">
                把「明暗」和「品牌色」当成两个独立维度：模式层负责背景、文字与边框，
                品牌层只覆盖强调色。这样 2 种模式 × 3 个品牌 = 6 套主题，
                但只需要维护 2 + 3 份变量，而不是 6 份。
            </p>
            <CodeBlock :code="THEME_CODE" lang="css" title="两轴主题" />
            <Callout type="tip" title="变量作用域">
                变量声明在 <code>:root</code> 时全站生效；声明在某个容器上时只影响该子树。
                后者正是「设计 Token」页面里局部换肤的实现方式。
            </Callout>
        </DocSection>

        <DocSection id="consume" title="组件如何消费 token" kicker="03 · CONSUME">
            <p class="body-text">
                组件只引用语义 token；需要局部微调时，在组件根节点声明组件层变量。
                这样组件的视觉完全由外部变量决定，测试与主题切换都不需要改组件。
            </p>
            <CodeBlock :code="CONSUMER_CODE" lang="css" title="组件消费语义 token" />
            <ul class="checklist">
                <li v-for="item in rules" :key="item">{{ item }}</li>
            </ul>
        </DocSection>

        <DocSection id="next" title="继续" kicker="04 · NEXT">
            <div class="route-grid">
                <NuxtLink to="/theming/dark" class="route-card">
                    <p class="route-kicker">LIVE</p>
                    <h3>暗色模式</h3>
                    <p>复用 useTheme()，验证切换、持久化与 html[data-theme]。</p>
                </NuxtLink>
                <NuxtLink to="/theming/tokens" class="route-card">
                    <p class="route-kicker">LIVE</p>
                    <h3>设计 Token</h3>
                    <p>在同一容器上切换 midnight / ocean / sunset 三套变量。</p>
                </NuxtLink>
            </div>
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

.checklist {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 14px 0 0;
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

.route-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
}

.route-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    transition: border-color 150ms ease, transform 150ms ease;
}

.route-card:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
}

.route-kicker {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    color: var(--accent);
}

.route-card h3 {
    margin: 2px 0 4px;
    font-size: 16px;
}

.route-card p:last-child {
    margin: 0;
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-muted);
}
</style>
