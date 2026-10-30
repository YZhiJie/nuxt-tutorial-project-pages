<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const STRATEGIES = [
    {
        name: 'SSR',
        rule: '默认 / ssr: true',
        freshness: '每请求实时',
        personal: '支持',
        cost: '高（每次渲染）',
        scene: '仪表盘、登录后首页、强个性化',
    },
    {
        name: 'SSG',
        rule: 'prerender: true',
        freshness: '构建时冻结',
        personal: '不支持',
        cost: '最低（直接发静态文件）',
        scene: '文档、营销页、条款与公告',
    },
    {
        name: 'ISR / SWR',
        rule: 'swr: 60',
        freshness: '最多滞后 60 秒',
        personal: '仅公共内容',
        cost: '低（命中缓存）',
        scene: '商品目录、博客列表、排行榜',
    },
    {
        name: 'CSR',
        rule: 'ssr: false',
        freshness: '浏览器实时',
        personal: '完全支持',
        cost: '中（首屏依赖 JS）',
        scene: '管理后台、编辑器、强交互工作台',
    },
];

const ROUTE_RULES = `export default defineNuxtConfig({
    routeRules: {
        // 当前项目已经在用的三条规则
        '/admin/**': { ssr: false },              // 后台纯客户端渲染
        '/rendering/ssg': { prerender: true },    // 构建期生成静态页
        '/rendering/isr': { swr: 60 },            // 60 秒后台再生

        // 常见的扩展写法
        '/docs/**': { prerender: true },
        '/blog/**': { swr: 300 },
        '/api/public/**': {
            headers: { 'cache-control': 'public, s-maxage=60' },
        },
    },
});`;

const matrix = [
    { freq: '秒级（库存、在线状态）', publicCell: 'SSR + no-store', userCell: 'SSR + 私有接口', tenantCell: 'SSR + 服务端鉴权' },
    { freq: '分钟级（订单、消息）', publicCell: 'SWR 30–60 秒', userCell: 'SSR 或 CSR 拉取', tenantCell: 'SSR + 私有缓存' },
    { freq: '小时 / 天级（商品、文章）', publicCell: 'SWR 300–3600 秒', userCell: 'SSG 外壳 + CSR 个人数据', tenantCell: 'SSG 外壳 + 鉴权接口' },
    { freq: '版本级（文档、条款）', publicCell: 'SSG prerender', userCell: 'SSG + 客户端登录态', tenantCell: 'SSG 公共壳 + SSR 接口' },
];

const pitfalls = [
    'routeRules 是服务端规则，站内客户端导航不会再生成 HTML，别指望它切换页面渲染方式。',
    '共享缓存（SWR / CDN）不能包含用户身份、Cookie 或权限差异，否则会串号。',
    '开发环境的缓存行为与生产不同，验证 SSG / SWR 必须 build 后 preview。',
    'prerender 页面在构建后不会自动更新，内容发布需要重新构建或改用 SWR。',
];
</script>

<template>
    <DocPage
        title="渲染策略"
        description="同一套 Nuxt 代码可以按路由选择 SSR、SSG、ISR/SWR 与 CSR。选择依据只有两个：内容变化频率与个性化程度。"
        :tags="['SSR', 'SSG', 'ISR / SWR', 'CSR', 'routeRules']"
    >
        <DocSection id="overview" title="四种策略对照" kicker="01 · OVERVIEW">
            <p class="body-text">
                渲染策略决定 HTML 在什么时刻生成、为谁生成、缓存多久。它直接影响首屏速度、
                服务器成本与内容新鲜度，因此应该按路由逐个决策，而不是全站一刀切。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>策略</th>
                            <th>routeRules</th>
                            <th>内容新鲜度</th>
                            <th>个性化</th>
                            <th>成本</th>
                            <th>典型场景</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in STRATEGIES" :key="row.name">
                            <td class="mono">{{ row.name }}</td>
                            <td class="mono">{{ row.rule }}</td>
                            <td>{{ row.freshness }}</td>
                            <td>{{ row.personal }}</td>
                            <td>{{ row.cost }}</td>
                            <td>{{ row.scene }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p class="body-text">
                SSG 与 ISR/SWR 都属于“服务端缓存 HTML”，区别只在再生时机：SSG 在构建时一次性生成，
                ISR/SWR 在运行期按 TTL 后台刷新。CSR 则把首屏交给浏览器，服务端只发一个空壳。
            </p>
        </DocSection>

        <DocSection id="matrix" title="决策矩阵" kicker="02 · DECISION">
            <p class="body-text">
                先回答两个问题：内容多久变一次？同一条 URL 对不同用户是否不同？
                两个答案组合起来，基本就决定了策略。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>内容变化频率</th>
                            <th>公共内容（所有人相同）</th>
                            <th>用户个性化</th>
                            <th>租户 / 权限相关</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in matrix" :key="row.freq">
                            <td>{{ row.freq }}</td>
                            <td>{{ row.publicCell }}</td>
                            <td>{{ row.userCell }}</td>
                            <td>{{ row.tenantCell }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <Callout type="tip" title="最常见的组合是“静态外壳 + 客户端个人数据”">
                商品页、文章页用 SSG 或 SWR 生成公共 HTML，
                登录态、购物车、收藏等个人数据在客户端通过接口补齐。
                这样既保留首屏速度，又不会把用户信息写进共享缓存。
            </Callout>
        </DocSection>

        <DocSection id="rules" title="routeRules：路由级开关" kicker="03 · ROUTERULES">
            <p class="body-text">
                <code>routeRules</code> 写在 <code>nuxt.config.ts</code>，按路径模式匹配。
                更具体的路径优先，因此可以用 <code>/**</code> 设置默认值，再用精确路径覆盖特例。
            </p>
            <CodeBlock :code="ROUTE_RULES" lang="ts" title="routeRules 示例（含本项目现有配置）" />
            <ul class="plain-list">
                <li><code>prerender: true</code>：构建时生成 HTML，适合 SSG。</li>
                <li><code>swr: 60</code>：首次请求生成并缓存 60 秒，期间返回旧内容并后台再生。</li>
                <li><code>ssr: false</code>：跳过服务端渲染，等价于 CSR。</li>
                <li><code>headers</code>：给接口或静态资源加 Cache-Control 等响应头。</li>
            </ul>
        </DocSection>

        <DocSection id="verify" title="如何验证策略生效" kicker="04 · VERIFY">
            <p class="body-text">
                最直接的证据是响应头与页面时间戳：SSG 页面没有实时数据；SWR 页面在 TTL 内
                <code>generatedAt</code> 保持不变；SSR 页面每次请求都会变化。
            </p>
            <div class="grid">
                <NuxtLink to="/rendering/ssr" class="strategy-link">
                    <span class="mono">SSR</span>
                    <span>每请求实时时钟与 requestId</span>
                </NuxtLink>
                <NuxtLink to="/rendering/ssg" class="strategy-link">
                    <span class="mono">SSG</span>
                    <span>构建期冻结与失效方式</span>
                </NuxtLink>
                <NuxtLink to="/rendering/isr" class="strategy-link">
                    <span class="mono">SWR</span>
                    <span>60 秒缓存与后台再生</span>
                </NuxtLink>
                <NuxtLink to="/rendering/hybrid" class="strategy-link">
                    <span class="mono">HYBRID</span>
                    <span>同站点混合决策清单</span>
                </NuxtLink>
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

.plain-list {
    margin: 0;
    padding-left: 18px;
    font-size: 13px;
    line-height: 1.9;
    color: var(--text-muted);
}

.strategy-link {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface-2);
    font-size: 13px;
    color: var(--text-muted);
    transition: border-color 140ms ease, transform 140ms ease;
}

.strategy-link:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
}

.strategy-link .mono {
    color: var(--accent);
    font-size: 11px;
    letter-spacing: 0.08em;
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
