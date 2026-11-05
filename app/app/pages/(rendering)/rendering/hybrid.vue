<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const matrix = [
    { scene: '产品文档、条款、公告', freq: '版本级', personal: '无', strategy: 'SSG', reason: '发布后不常变，静态文件最快' },
    { scene: '商品详情、博客列表', freq: '分钟–小时', personal: '无', strategy: 'SWR 60–3600 秒', reason: '允许短暂滞后，省掉每请求渲染' },
    { scene: '首页推荐、活动页', freq: '分钟级', personal: '弱（推荐位）', strategy: 'SSG 外壳 + CSR 数据', reason: '公共壳静态化，个性化在客户端补齐' },
    { scene: '用户仪表盘', freq: '秒级', personal: '强', strategy: 'SSR + no-store', reason: '必须按用户实时渲染，不能共享缓存' },
    { scene: '管理后台、编辑器', freq: '实时', personal: '强', strategy: 'CSR + API', reason: '交互密集，首屏 HTML 价值低' },
    { scene: '多租户控制台', freq: '实时', personal: '租户级', strategy: 'SSR + 私有缓存', reason: '缓存必须按租户隔离' },
    { scene: '登录后的订单详情', freq: '秒级', personal: '强', strategy: 'SSR 或 CSR + 私有接口', reason: '任何共享缓存都会串号' },
];

const RULES_CODE = `export default defineNuxtConfig({
    routeRules: {
        // 公共、版本级：构建期静态化
        '/': { prerender: true },
        '/docs/**': { prerender: true },

        // 公共、小时级：增量再生
        '/blog/**': { swr: 3600 },
        '/products/**': { swr: 60 },

        // 个性化、实时：每请求 SSR
        '/dashboard/**': { ssr: true },
        '/checkout/**': { ssr: true },

        // 强交互后台：纯客户端
        '/admin/**': { ssr: false },

        // 公共接口单独缓存，避免页面与接口双重缓存失控
        '/api/public/**': {
            headers: { 'cache-control': 'public, s-maxage=60' },
        },
    },
});`;

const SHELL_CODE = `// 公共页面：prerender / swr 生成 HTML 外壳
// 个人数据：只允许在客户端拉取，避免写进共享缓存
const { data: profile } = await useFetch('/api/me', {
    server: false,          // 不参与 SSR，不进入 payload
    key: 'current-profile', // 显式 key，便于失效与调试
});

// 服务端接口仍要设置私有缓存头
// cache-control: private, no-store`;

const pitfalls = [
    'routeRules 只在服务端生效，客户端导航时不会重新选择渲染模式。',
    '共享缓存必须按“公共 / 用户 / 租户”分级，不能只靠路径前缀。',
    'SSG 页面里的个人数据要通过 server: false 或私有接口补齐，不能写进 HTML。',
    '规则越具体优先级越高，但不要把 /** 默认值写得过宽，导致特例难以覆盖。',
    '上线前用 curl -I 检查 cache-control，不要只看页面是否“看起来正确”。',
];
</script>

<template>
    <DocPage
        title="混合渲染决策"
        description="真实站点很少只用一种渲染策略。按“内容变化频率 × 个性化程度”给每条路由选型，再用 routeRules 把决策落地。"
        :tags="['混合渲染', '决策矩阵', 'routeRules', '缓存分级']"
    >
        <DocSection id="dimensions" title="只看两个维度" kicker="01 · DIMENSIONS">
            <p class="body-text">
                第一个维度是内容多久变化一次：秒级、分钟级、小时级还是版本级。
                第二个维度是同一条 URL 对不同人是否不同：公共、弱个性化、强个性化、租户隔离。
            </p>
            <div class="grid">
                <div class="card card--soft">
                    <p class="card-title">内容新鲜度</p>
                    <ul class="plain-list">
                        <li>秒级：必须每请求渲染</li>
                        <li>分钟级：SWR 短 TTL</li>
                        <li>小时 / 天级：SWR 长 TTL</li>
                        <li>版本级：构建期静态化</li>
                    </ul>
                </div>
                <div class="card card--soft">
                    <p class="card-title">个性化程度</p>
                    <ul class="plain-list">
                        <li>公共：可被 CDN 共享</li>
                        <li>弱个性化：公共壳 + 客户端数据</li>
                        <li>强个性化：SSR + no-store</li>
                        <li>租户级：私有缓存 + 隔离键</li>
                    </ul>
                </div>
            </div>
            <Callout type="tip" title="先做“最差可接受的新鲜度”">
                问业务方“内容晚 1 分钟、晚 1 小时分别能否接受”，答案往往直接决定 TTL，
                比讨论框架性能更有效。
            </Callout>
        </DocSection>

        <DocSection id="matrix" title="决策表" kicker="02 · MATRIX">
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>典型页面</th>
                            <th>变化频率</th>
                            <th>个性化</th>
                            <th>推荐策略</th>
                            <th>理由</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in matrix" :key="row.scene">
                            <td>{{ row.scene }}</td>
                            <td>{{ row.freq }}</td>
                            <td>{{ row.personal }}</td>
                            <td class="mono strategy">{{ row.strategy }}</td>
                            <td>{{ row.reason }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p class="body-text">
                最常见的混合形态是“公共外壳静态化 + 个人数据客户端拉取”。
                它同时满足首屏速度与个性化，但要求接口明确区分公共与私有缓存。
            </p>
        </DocSection>

        <DocSection id="rules" title="用 routeRules 组合落地" kicker="03 · ROUTES">
            <p class="body-text">
                同一条规则只描述“这一段路径怎么渲染”。按业务域拆开后，
                站点就形成一张可评审的渲染地图，而不是全站一个默认值。
            </p>
            <CodeBlock :code="RULES_CODE" lang="ts" title="按业务域拆分 routeRules" />
            <CodeBlock :code="SHELL_CODE" lang="ts" title="公共壳 + 个人数据" />
            <p class="body-text">
                更具体的路径优先于通配路径。例如 <code>/products/:id</code> 需要实时库存时，
                可以单独覆盖 <code>/products/**</code> 的 SWR 规则。
            </p>
        </DocSection>

        <DocSection id="checklist" title="上线前核对清单" kicker="04 · CHECKLIST">
            <p class="body-text">
                渲染策略的 bug 往往不是“页面打不开”，而是“看到了别人的数据”或“内容永远不更新”。
                上线前逐条核对：
            </p>
            <ul class="checklist">
                <li v-for="item in pitfalls" :key="item">{{ item }}</li>
            </ul>
            <div class="next-links">
                <NuxtLink to="/rendering/ssr" class="next-link">复习 SSR 实时渲染 →</NuxtLink>
                <NuxtLink to="/rendering/isr" class="next-link">复习 SWR 增量再生 →</NuxtLink>
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
    line-height: 1.9;
    color: var(--text-muted);
}

.strategy {
    color: var(--accent);
    white-space: nowrap;
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

.next-links {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 18px;
}

.next-link {
    padding: 8px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    font-size: 12px;
    color: var(--accent);
    transition: border-color 140ms ease;
}

.next-link:hover {
    border-color: var(--accent);
}
</style>
