<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const TREE = `app/
├── pages/
│   ├── (routing)/routing/index.vue        → /routing
│   ├── (security)/security/index.vue      → /security
│   ├── (fullstack)/fullstack/index.vue    → /fullstack
│   └── (deployment)/deployment/index.vue  → /deployment
└── layouts/
    ├── default.vue                  → 首页等无侧边栏场景
    ├── docs.vue                     → 文档站布局
    ├── admin.vue                    → 后台布局
    └── blank.vue                    → 无装饰布局`;

const GROUP_CODE = `// 圆括号目录只用于组织文件，不参与 URL
app/pages/(security)/security/index.vue     → /security
app/pages/(fullstack)/fullstack/index.vue   → /fullstack
app/pages/(routing)/routing/index.vue       → /routing

// 同一业务域的页面放在一起，便于权限、菜单与埋点统一配置
// (routing)、(security) 这类分组名只是给人看的，可以随时改名`;

const SELECT_CODE = `// 页面级静态选择：文件名去掉 .vue 就是布局名
definePageMeta({ layout: 'docs' });

// 关闭布局：页面自己负责全部外壳（登录页、全屏可视化常用）
definePageMeta({ layout: false });

// 运行时切换：适合“预览模式 / 编辑模式”这类状态驱动的外壳
await setPageLayout('admin');`;

const NESTED_CODE = `<!-- app/layouts/base.vue：只负责顶栏与内容容器 -->
<template>
    <div class="base-shell">
        <DocsHeader />
        <slot />
    </div>
</template>

<!-- app/layouts/docs.vue：在布局内部再套一层 base -->
<template>
    <NuxtLayout name="base">
        <DocsSidebar />
        <main class="docs-main">
            <slot />
        </main>
    </NuxtLayout>
</template>`;

const LAYOUT_USAGE = [
    { file: 'default.vue', scene: '普通站点页面', note: '未声明 layout 时的兜底' },
    { file: 'docs.vue', scene: '文档与知识站', note: '左侧模块导航 + 内容区' },
    { file: 'admin.vue', scene: '管理后台', note: '通常配合 ssr: false' },
    { file: 'blank.vue', scene: '登录、全屏页', note: '只保留最小容器' },
];

const pitfalls = [
    '布局名是文件名，改名会让所有 definePageMeta({ layout }) 失效，需要全局搜索。',
    '路由组不会自动绑定布局，布局仍由 definePageMeta 或 setPageLayout 决定。',
    '布局里的数据请求会被所有子页面共享，避免在布局中拉取只属于某个页面的数据。',
    '嵌套布局不要形成环（docs 套 docs），否则会递归渲染直到栈溢出。',
];
</script>

<template>
    <DocPage
        title="路由组与嵌套布局"
        description="圆括号目录解决“文件怎么放”，layouts/ 解决“页面长什么样”。两者正交：路由组不改变 URL，布局不改变路由匹配。"
        :tags="['(group)', 'layouts', 'definePageMeta', '嵌套布局']"
    >
        <DocSection id="group" title="路由组只影响文件组织" kicker="01 · GROUP">
            <p class="body-text">
                目录名加圆括号后，这一段不会进入 URL。它的价值是让同一业务域的页面共享目录、
                共享工具函数与权限配置，同时保持 URL 简洁。
            </p>
            <CodeBlock :code="TREE" lang="text" title="目录与布局" />
            <CodeBlock :code="GROUP_CODE" lang="text" title="路由组示例" />
            <Callout type="info" title="路由组不是权限边界">
                它只是文件组织手段，不会自动拦截请求。真正的访问控制要放在中间件、
                服务端接口或页面守卫里，不能依赖目录名。
            </Callout>
        </DocSection>

        <DocSection id="layouts" title="布局是页面外壳" kicker="02 · LAYOUTS">
            <p class="body-text">
                <code>app/layouts/</code> 下的每个文件都是一个可复用外壳，文件名即布局名。
                Nuxt 会在页面外层渲染对应布局，并把页面内容放进默认插槽。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>布局文件</th><th>使用场景</th><th>说明</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in LAYOUT_USAGE" :key="row.file">
                            <td class="mono">{{ row.file }}</td>
                            <td>{{ row.scene }}</td>
                            <td>{{ row.note }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p class="body-text">
                本页顶部声明了 <code>definePageMeta({ layout: 'docs' })</code>，
                所以会渲染左侧导航与文档页脚；同一个 URL 切换到其他布局，路由本身完全不变。
            </p>
            <CodeBlock :code="SELECT_CODE" lang="ts" title="选择、关闭与运行时切换" />
        </DocSection>

        <DocSection id="nested" title="嵌套布局" kicker="03 · NESTED">
            <p class="body-text">
                布局内部可以再使用 <code>&lt;NuxtLayout name="..."&gt;</code>，把通用外壳与业务外壳分层。
                外层负责品牌、顶栏与全局样式，内层负责侧边栏或工具栏。
            </p>
            <CodeBlock :code="NESTED_CODE" lang="vue" title="base + docs 两层布局" />
            <p class="body-text">
                嵌套时务必显式写 <code>name</code>。不写会尝试按当前路由解析布局，
                容易与页面声明的布局重复，形成自我嵌套。
            </p>
            <Callout type="warn" title="布局不是越深越好">
                每多一层布局，就多一层组件树与插槽传递。两层通常足够；
                三层以上应重新审视页面结构，避免为了复用而牺牲可读性。
            </Callout>
        </DocSection>

        <DocSection id="pitfalls" title="常见坑" kicker="04 · PITFALLS">
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
