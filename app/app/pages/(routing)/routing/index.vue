<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const DIRECTORY = `app/pages/
├── index.vue                    → /
├── (marketing)/about.vue        → /about     路由组不参与 URL
├── (routing)/routing/
│   ├── index.vue                → /routing
│   ├── dynamic/
│   │   ├── index.vue            → /routing/dynamic
│   │   └── [id].vue             → /routing/dynamic/:id
│   └── catch-all/
│       ├── index.vue            → /routing/catch-all
│       └── [...slug].vue        → /routing/catch-all/*`;

const DYNAMIC_CODE = `<!-- app/pages/(routing)/routing/dynamic/[id].vue -->
<script setup lang="ts">
const route = useRoute();
const id = Number(route.params.id);

// 非法参数直接抛 404，交给全局 error.vue
if (!Number.isInteger(id)) {
    throw createError({ statusCode: 404, statusMessage: '笔记不存在' });
}
<\/script>`;

const NAV_CODE = `// 声明式跳转：优先用 NuxtLink（可被预取、可被搜索引擎抓取）
<NuxtLink to="/routing/dynamic/42">打开详情</NuxtLink>

// 命令式跳转：适合提交表单后跳转
await navigateTo('/routing/dynamic/42');

// 外部链接 / 新窗口
await navigateTo('https://nuxt.com', { external: true, open: { target: '_blank' } })`;

const ROUTE_GROUP_CODE = `// 路由组：(group) 只用于组织文件，不出现在 URL
app/pages/
├── (account)/dashboard.vue   → /dashboard
├── (auth)/login.vue          → /login
└── (admin)/admin/index.vue   → /admin

// 同一业务域的页面共享一个目录，便于维护与权限配置`;

const table = [
    { file: 'index.vue', url: '/', desc: '目录首页' },
    { file: 'about.vue', url: '/about', desc: '静态路由' },
    { file: '[id].vue', url: '/:id', desc: '动态段，必填' },
    { file: '[...slug].vue', url: '/*', desc: '通配段，至少一段' },
    { file: '[[...slug]].vue', url: '/*?', desc: '可选通配段，可为空' },
    { file: '(group)/page.vue', url: '/page', desc: '路由组，不参与 URL' },
];

const pitfalls = [
    '动态段参数永远是字符串：需要数字时显式 Number() 并校验 NaN。',
    '页面文件与同名目录并存会冲突，用 index.vue 表达目录首页。',
    '通配路由优先级最低，但过度使用会让真实 404 消失，建议仅用于文档 / 兼容旧地址。',
    '路由组不能解决“同一 URL 多布局”，那属于布局与中间件的职责。',
];
</script>

<template>
    <DocPage
        title="路由与导航"
        description="Nuxt 的路由完全由文件系统生成：目录即路径，文件名即段类型。理解段类型与优先级，才能设计出可维护的 URL 结构。"
        tags="文件路由,动态段,路由组,嵌套布局,导航控制"
    >
        <DocSection id="overview" title="文件即路由" kicker="01 · OVERVIEW">
            <p class="body-text">
                Nuxt 扫描 <code>app/pages/</code> 生成 vue-router 路由表。没有额外的路由配置，
                目录结构就是产品信息架构。下面的目录同时演示了五种常见段类型：
            </p>
            <CodeBlock :code="DIRECTORY" lang="text" title="目录 → URL" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>文件</th><th>URL</th><th>说明</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in table" :key="row.file">
                            <td class="mono">{{ row.file }}</td>
                            <td class="mono">{{ row.url }}</td>
                            <td>{{ row.desc }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="dynamic" title="动态段与参数校验" kicker="02 · DYNAMIC">
            <p class="body-text">
                动态段用方括号命名，参数通过 <code>useRoute().params</code> 读取。
                永远不要相信 URL：类型、范围、存在性都应在进入业务逻辑前校验。
            </p>
            <CodeBlock :code="DYNAMIC_CODE" lang="vue" title="动态路由 + 404 兜底" />
            <Callout type="tip" title="参数校验放在页面入口">
                非法参数尽早抛 <code>createError</code>，让全局 <code>error.vue</code> 统一渲染，
                不要在每个组件里重复写空状态。
            </Callout>
        </DocSection>

        <DocSection id="group" title="路由组与嵌套布局" kicker="03 · GROUPING">
            <p class="body-text">
                圆括号目录是路由组，只用于文件组织，不会出现在 URL。
                业务域清晰的目录能直接映射到权限、菜单与埋点配置。
            </p>
            <CodeBlock :code="ROUTE_GROUP_CODE" lang="text" title="路由组" />
            <p class="body-text">
                嵌套布局则由 <code>layouts/</code> + <code>definePageMeta({ layout: 'docs' })</code> 完成。
                布局负责页面外壳，路由组负责文件归属，两者互不替代。
            </p>
        </DocSection>

        <DocSection id="navigation" title="导航控制" kicker="04 · NAVIGATION">
            <p class="body-text">
                站内跳转优先使用 <code>NuxtLink</code>，它支持预取、无刷新导航和 SEO 抓取。
                只有“动作完成后跳转”这类场景才使用命令式导航。
            </p>
            <CodeBlock :code="NAV_CODE" lang="ts" title="声明式 vs 命令式" />
            <DemoCard title="试着跳转一次" desc="点击按钮触发 navigateTo，观察地址栏与页面过渡。">
                <div class="nav-demo">
                    <button class="btn" @click="navigateTo('/routing/dynamic/42')">跳转到 /routing/dynamic/42</button>
                    <button class="btn btn--ghost" @click="navigateTo('/routing/catch-all/a/b/c')">跳转到通配路由</button>
                    <NuxtLink to="/routing/layouts" class="nav-link">NuxtLink 声明式跳转 →</NuxtLink>
                </div>
            </DemoCard>
        </DocSection>

        <DocSection id="pitfalls" title="常见坑" kicker="05 · PITFALLS">
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

.nav-demo {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
}

.nav-link {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--accent);
    border-bottom: 1px dashed var(--accent);
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
