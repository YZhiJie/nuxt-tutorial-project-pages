<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const route = useRoute();
const slug = computed(() => route.params.slug);

// 兼容两种形态：数组（vue-router 通配段）或单字符串（手写兼容逻辑）
const segments = computed<string[]>(() => {
    const value = slug.value;
    if (Array.isArray(value)) return value;
    return value ? [value] : [];
});

const rebuilt = computed(() => `/routing/catch-all/${segments.value.join('/')}`);

const MATCH_CODE = `const route = useRoute();

// URL: /routing/catch-all/alpha/beta/gamma
route.params.slug;   // ['alpha', 'beta', 'gamma']
route.path;          // '/routing/catch-all/alpha/beta/gamma'
route.params.slug?.length;   // 3`;

const NORMALIZE_CODE = `// 组件内部统一成 string[]，后续逻辑不再判断类型
const segments = computed<string[]>(() => {
    const value = route.params.slug;
    if (Array.isArray(value)) return value;
    return value ? [value] : [];
});

// 还原成可读路径，注意不要假设只有一段
const path = segments.value.join('/');`;

const CHECK_CODE = `// 通配命中不等于资源存在：可以查注册表或调用后端
const allowed = new Set(['alpha', 'beta', 'gamma']);

if (!segments.value.every((segment) => allowed.has(segment))) {
    throw createError({ statusCode: 404, statusMessage: '路径不存在' });
}`;

const pitfalls = [
    'params.slug 的类型可能是 string | string[]，直接 .join() 前先归一化。',
    '不要用字符串 split("/") 去解析 route.params.slug，数组本身已经保留层级。',
    '通配页默认返回 200，不校验资源就会让无效链接被搜索引擎收录。',
    '通配页共享缓存时不要读取 Cookie 或用户身份，避免缓存污染。',
];
</script>

<template>
    <DocPage
        title="通配路由：匹配结果"
        description="这个页面由 [...slug].vue 命中。它把 URL 中剩余的所有段收进 route.params.slug，并展示原始数组、段数与还原后的路径。"
        :tags="['route.params.slug', '路径段', '数组归一化', '404']"
    >
        <DocSection id="result" title="当前匹配结果" kicker="01 · RESULT">
            <p class="body-text">
                通配段不会被拆成多个参数名，而是整体放进 <code>slug</code>。
                数组顺序就是 URL 中的书写顺序，因此可以直接用于面包屑或文件路径。
            </p>
            <DemoCard title="slug 快照" desc="地址栏增加或减少层级，下列值会同步变化。" badge="LIVE">
                <dl class="stat-grid">
                    <div class="stat">
                        <dt>route.params.slug</dt>
                        <dd class="mono">{{ JSON.stringify(slug ?? null) }}</dd>
                    </div>
                    <div class="stat">
                        <dt>参数类型</dt>
                        <dd class="mono">{{ Array.isArray(slug) ? 'string[]' : 'string' }}</dd>
                    </div>
                    <div class="stat">
                        <dt>路径段数量</dt>
                        <dd class="mono">{{ segments.length }}</dd>
                    </div>
                    <div class="stat">
                        <dt>还原后的路径</dt>
                        <dd class="mono">{{ rebuilt }}</dd>
                    </div>
                </dl>
                <div class="segment-row">
                    <span v-for="(segment, index) in segments" :key="index" class="badge">
                        {{ index }} · {{ segment }}
                    </span>
                </div>
                <template #footer>
                    <div class="demo-actions">
                        <NuxtLink to="/routing/catch-all" class="btn btn--ghost btn--sm">返回通配说明</NuxtLink>
                        <NuxtLink to="/routing/catch-all/alpha/beta/gamma" class="btn btn--ghost btn--sm">三段路径</NuxtLink>
                    </div>
                </template>
            </DemoCard>
            <CodeBlock :code="MATCH_CODE" lang="ts" title="读取与观察" />
        </DocSection>

        <DocSection id="normalize" title="统一成字符串数组" kicker="02 · NORMALIZE">
            <p class="body-text">
                实际项目里通配参数通常稳定是数组，但把归一化逻辑集中到一处，可以同时兼容字符串形态，
                也让组件与纯函数更容易测试。
            </p>
            <CodeBlock :code="NORMALIZE_CODE" lang="ts" title="参数归一化" />
            <Callout type="tip" title="先归一化，再执行业务">
                面包屑、权限判断、日志埋点都依赖“路径段数组”这一稳定形态。
                在页面入口完成转换，避免每个组件各写一套 <code>Array.isArray</code>。
            </Callout>
        </DocSection>

        <DocSection id="deep" title="深层路径如何解析" kicker="03 · DEPTH">
            <p class="body-text">
                一个 <code>[...slug].vue</code> 负责整棵子树，不会为每一层自动生成页面。
                如果文档有真实的层级菜单，通常把 slug 交给内容服务查询，
                而不是在客户端按段数递归渲染。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>请求路径</th><th>slug</th><th>段数</th><th>建议处理</th></tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="mono">/routing/catch-all/one</td>
                            <td class="mono">['one']</td>
                            <td>1</td>
                            <td>按一级文章查询</td>
                        </tr>
                        <tr>
                            <td class="mono">/routing/catch-all/alpha/beta</td>
                            <td class="mono">['alpha', 'beta']</td>
                            <td>2</td>
                            <td>按分类 + 文章查询</td>
                        </tr>
                        <tr>
                            <td class="mono">/routing/catch-all/alpha/beta/gamma</td>
                            <td class="mono">['alpha', 'beta', 'gamma']</td>
                            <td>3</td>
                            <td>按完整路径匹配内容</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="boundary" title="校验、404 与缓存" kicker="04 · BOUNDARY">
            <p class="body-text">
                通配页必须有“资源是否存在”的第二道校验。对示例路径来说，只要任何一段不在白名单中，
                就应该返回 404，而不是渲染一个空页面。
            </p>
            <CodeBlock :code="CHECK_CODE" lang="ts" title="内容校验" />
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

.stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    margin: 0;
}

.stat {
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
}

.stat dt {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-faint);
}

.stat dd {
    margin: 6px 0 0;
    font-size: 14px;
    color: var(--accent);
    word-break: break-all;
}

.segment-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
}

.demo-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
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
