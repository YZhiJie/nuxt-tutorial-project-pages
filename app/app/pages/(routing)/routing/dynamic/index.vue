<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const DIRECTORY = `app/pages/(routing)/routing/dynamic/
├── index.vue             → /routing/dynamic
├── [id].vue              → /routing/dynamic/:id
└── [id]/
    └── [tab].vue         → /routing/dynamic/:id/:tab`;

const PARAM_CODE = `const route = useRoute();

// 当前 URL：/routing/dynamic/42
route.params.id;     // '42'，动态段永远是字符串
route.path;          // '/routing/dynamic/42'
route.fullPath;      // 带上 query 与 hash 的完整地址
route.name;          // Nuxt 生成的路由名

// 多段动态：/routing/dynamic/42/comments
route.params;        // { id: '42', tab: 'comments' }

// 参数会随导航变化，放进 computed 保持响应式
const rawId = computed(() => route.params.id);`;

const VALIDATE_CODE = `// 方案 A：路由层校验，返回 false 时按 404 处理
definePageMeta({
    validate: (route) => /^\\d+$/.test(String(route.params.id)),
});

// 方案 B：业务层校验，进入页面后自行判断
const route = useRoute();
const id = Number(route.params.id);

if (!Number.isInteger(id)) {
    throw createError({
        statusCode: 404,
        statusMessage: '动态参数必须是整数',
    });
}`;

const SEO_CODE = `useSeoMeta({
    title: () => '动态参数 #' + numericId,
    description: () => '当前路径：' + route.fullPath,
});`;

const routes = [
    { url: '/routing/dynamic', match: 'index.vue', desc: '列表页，静态段优先于 [id]' },
    { url: '/routing/dynamic/1', match: '[id].vue', desc: 'id = "1"，最基础的详情' },
    { url: '/routing/dynamic/2', match: '[id].vue', desc: 'id = "2"，验证页面切换' },
    { url: '/routing/dynamic/42', match: '[id].vue', desc: 'id = "42"，多位数参数' },
    { url: '/routing/dynamic/abc', match: '[id].vue', desc: '校验失败，进入 404 错误页' },
];

const pitfalls = [
    'route.params 里的值永远是字符串，Number() 之后再校验，不能直接比较数字。',
    'Number("") 等于 0、Number("1e3") 等于 1000，仅靠 isInteger 会放过意外输入。',
    '页面组件在参数变化时可能复用，读取参数请用 computed，不要只在 setup 里取一次。',
    '静态段 /routing/dynamic 由 index.vue 命中，不会被 [id].vue 当成 id="dynamic"。',
];
</script>

<template>
    <DocPage
        title="动态路由参数"
        description="用 [id] 这样的方括号目录表达“同一页面、不同参数”。本节从文件结构、参数来源讲到校验、404 与 SEO 联动。"
        :tags="['[id]', 'route.params', '参数校验', '404', 'SEO']"
    >
        <DocSection id="structure" title="文件结构决定参数名" kicker="01 · STRUCTURE">
            <p class="body-text">
                方括号中的名字就是 <code>route.params</code> 的键名。目录层级越深，参数段越多；
                参数名可以任意起，但一旦被链接、埋点或接口引用，就等价于对外契约，改名需要同步搜索替换。
            </p>
            <CodeBlock :code="DIRECTORY" lang="text" title="目录 → URL" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>访问地址</th><th>命中的文件</th><th>说明</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in routes" :key="row.url">
                            <td class="mono">{{ row.url }}</td>
                            <td class="mono">{{ row.match }}</td>
                            <td>{{ row.desc }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <Callout type="info" title="静态段优先">
                vue-router 按“静态段 → 动态段 → 通配段”的优先级排序。因此
                <code>/routing/dynamic</code> 一定命中 <code>index.vue</code>，
                不会被 <code>[id].vue</code> 当作 <code>id: 'dynamic'</code>。
            </Callout>
        </DocSection>

        <DocSection id="params" title="参数从哪里来" kicker="02 · PARAMS">
            <p class="body-text">
                动态段的值由 URL 路径解析而来，挂在 <code>useRoute()</code> 返回的响应式路由对象上。
                它不经过查询串、不来自请求体，也不做类型转换。
            </p>
            <CodeBlock :code="PARAM_CODE" lang="ts" title="读取 route.params" />
            <p class="body-text">
                需要把参数传给接口时，仍然要在服务端重新校验一次。客户端校验只改善体验，
                不能作为权限或业务正确性的依据。
            </p>
        </DocSection>

        <DocSection id="validate" title="校验与 404 兜底" kicker="03 · VALIDATION">
            <p class="body-text">
                Nuxt 提供两层校验：路由层的 <code>validate</code> 决定这条路由是否成立；
                页面 setup 里的 <code>createError</code> 决定业务资源是否存在。
                前者适合格式约束，后者适合“格式合法但记录不存在”。
            </p>
            <CodeBlock :code="VALIDATE_CODE" lang="ts" title="两种校验位置" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>方式</th><th>执行时机</th><th>失败表现</th><th>适用</th></tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="mono">definePageMeta.validate</td>
                            <td>路由解析、进入页面前</td>
                            <td>导航被取消，渲染 404</td>
                            <td>格式、枚举、必填参数</td>
                        </tr>
                        <tr>
                            <td class="mono">throw createError</td>
                            <td>页面 setup 执行时</td>
                            <td>全局 error.vue，带状态码</td>
                            <td>资源不存在、无权限</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <Callout type="warn" title="Number 的常见陷阱">
                <code>Number('')</code> 得到 0，<code>Number('1e3')</code> 得到 1000，
                <code>Number('0x10')</code> 得到 16。稳妥做法是先用 <code>/^\\d+$/</code>
                限定十进制整数，再转成 number。
            </Callout>
        </DocSection>

        <DocSection id="demo" title="现场验证" kicker="04 · DEMO">
            <p class="body-text">
                点击下面的地址分别观察合法参数与非法参数。非法参数会直接进入
                <code>error.vue</code>，而不是渲染一个空详情页。
            </p>
            <DemoCard title="动态参数链接" desc="合法的 id 会渲染详情页；abc 会触发 404。">
                <div class="link-grid">
                    <NuxtLink to="/routing/dynamic/1" class="demo-link mono">/routing/dynamic/1</NuxtLink>
                    <NuxtLink to="/routing/dynamic/2" class="demo-link mono">/routing/dynamic/2</NuxtLink>
                    <NuxtLink to="/routing/dynamic/42" class="demo-link mono">/routing/dynamic/42</NuxtLink>
                    <NuxtLink to="/routing/dynamic/abc" class="demo-link demo-link--danger mono">
                        /routing/dynamic/abc
                    </NuxtLink>
                </div>
            </DemoCard>
            <p class="body-text">
                详情页还会用参数生成页面标题，保证每个 URL 都有唯一、可抓取的标题：
            </p>
            <CodeBlock :code="SEO_CODE" lang="ts" title="动态 SEO 标题" />
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

.link-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
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

.demo-link--danger:hover {
    border-color: var(--danger);
    color: var(--danger);
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
