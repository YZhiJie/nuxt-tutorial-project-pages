<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const TREE = `app/pages/(routing)/routing/catch-all/
├── index.vue        → /routing/catch-all
└── [...slug].vue    → /routing/catch-all/**   必填，至少一段

可选通配段的写法（通常放在根目录做兜底）：
app/pages/
└── [[...slug]].vue  → /**?                    可零段，也可多段`;

const PARAM_CODE = `const route = useRoute();

// URL: /routing/catch-all/alpha/beta/gamma
route.params.slug;   // ['alpha', 'beta', 'gamma']

// 即使只有一段，通配段仍然是数组
// URL: /routing/catch-all/one
route.params.slug;   // ['one']

// 参数顺序与 URL 完全一致，不会丢失斜杠层级
route.params.slug?.join('/');   // 'one'`;

const PRIORITY_CODE = `// vue-router 的匹配优先级（从高到低）
// 1. 静态段   /routing/catch-all
// 2. 动态段   /routing/dynamic/:id
// 3. 通配段   /routing/catch-all/**

// 因此 /routing/catch-all 会命中 index.vue，
// 不会被 [...slug].vue 当成 slug: ['catch-all']`;

const rows = [
    { file: 'index.vue', match: '/routing/catch-all', zero: '命中', params: '无' },
    { file: '[...slug].vue', match: '/routing/catch-all/alpha', zero: '不命中', params: "['alpha']" },
    { file: '[...slug].vue', match: '/routing/catch-all/a/b/c', zero: '不命中', params: "['a', 'b', 'c']" },
    { file: '[[...slug]].vue', match: '任意路径（含 /）', zero: '命中', params: '[] 或路径段数组' },
];

const pitfalls = [
    '通配段会把本该 404 的地址变成 200，务必在页面内校验 slug 是否对应真实资源。',
    '共享缓存下不要把用户信息渲染进通配页，否则不同用户可能拿到同一份 HTML。',
    '通配页的 canonical 不要写死当前 URL 之外的地址，否则搜索引擎无法区分页面。',
    '不要用通配路由承接登录、支付等强约束流程，显式路由更利于权限与审计。',
];
</script>

<template>
    <DocPage
        title="通配路由"
        description="[...slug] 用剩余路径段兜住一整棵子树。它适合文档、旧链接兼容与搜索建议，但必须配合业务校验，否则会吞掉真实 404。"
        :tags="['[...slug]', '[[...slug]]', '匹配优先级', '404']"
    >
        <DocSection id="types" title="必填与可选两种通配" kicker="01 · TYPES">
            <p class="body-text">
                方括号里写三个点表示“剩余段”。单层方括号是必填通配，至少消费一段路径；
                双层方括号是可选通配，零段时也能命中。两者都不参与目录名，只消费 URL。
            </p>
            <CodeBlock :code="TREE" lang="text" title="目录结构" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>文件</th><th>匹配示例</th><th>零段</th><th>route.params.slug</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in rows" :key="row.file + row.match">
                            <td class="mono">{{ row.file }}</td>
                            <td class="mono">{{ row.match }}</td>
                            <td>{{ row.zero }}</td>
                            <td class="mono">{{ row.params }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="params" title="参数形态与读取" kicker="02 · PARAMS">
            <p class="body-text">
                通配段的参数是“路径段数组”，不是带斜杠的字符串。拼接回路径时使用
                <code>join('/')</code>，不要假设它只有一段。
            </p>
            <CodeBlock :code="PARAM_CODE" lang="ts" title="读取 slug" />
            <DemoCard title="点开一条多段路径" desc="页面会展示原始数组、段数与重新拼接的路径。">
                <div class="link-grid">
                    <NuxtLink to="/routing/catch-all/alpha/beta/gamma" class="demo-link mono">
                        /routing/catch-all/alpha/beta/gamma
                    </NuxtLink>
                    <NuxtLink to="/routing/catch-all/one" class="demo-link mono">
                        /routing/catch-all/one
                    </NuxtLink>
                    <NuxtLink to="/routing/catch-all" class="demo-link mono">
                        /routing/catch-all
                    </NuxtLink>
                </div>
            </DemoCard>
        </DocSection>

        <DocSection id="priority" title="匹配优先级" kicker="03 · PRIORITY">
            <p class="body-text">
                通配段是最后兜底的段类型。只要存在更精确的静态段或动态段，vue-router 一定先选更精确的那条。
                所以同一个目录里 <code>index.vue</code> 与 <code>[...slug].vue</code> 可以安全共存。
            </p>
            <CodeBlock :code="PRIORITY_CODE" lang="text" title="路由排序规则" />
            <Callout type="warn" title="通配不是 404 的替代品">
                <code>[...slug]</code> 匹配成功意味着 HTTP 200。若资源不存在，
                请在页面内 <code>throw createError({ statusCode: 404 })</code>，
                否则爬虫会把无效地址当成有效页面收录。
            </Callout>
        </DocSection>

        <DocSection id="scenarios" title="适用场景与边界" kicker="04 · SCENARIOS">
            <p class="body-text">
                通配路由最典型的用途是“一棵内容树的兜底”：文档、帮助中心、旧站迁移后的任意深链接。
                它让新增页面无需改造路由表，但把校验责任转移到了页面逻辑。
            </p>
            <div class="grid">
                <div class="card card--soft">
                    <p class="card-title">适合</p>
                    <ul class="plain-list">
                        <li>文档 / Wiki 的深层路径</li>
                        <li>旧站 URL 兼容与跳转</li>
                        <li>文件或目录浏览</li>
                    </ul>
                </div>
                <div class="card card--soft">
                    <p class="card-title">不适合</p>
                    <ul class="plain-list">
                        <li>登录、支付等强约束流程</li>
                        <li>需要精细权限判断的资源</li>
                        <li>个性化且不可共享的页面</li>
                    </ul>
                </div>
            </div>
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

.link-grid {
    display: grid;
    gap: 10px;
}

.demo-link {
    padding: 10px 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    font-size: 13px;
    transition: border-color 140ms ease, color 140ms ease;
}

.demo-link:hover {
    border-color: var(--accent);
    color: var(--accent);
}

.card-title {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
}

.plain-list {
    margin: 0;
    padding-left: 18px;
    font-size: 13px;
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
