<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const CONFIG_CODE = `export default defineNuxtConfig({
    routeRules: {
        // 单页静态化
        '/rendering/ssg': { prerender: true },

        // 整棵文档树静态化
        '/docs/**': { prerender: true },
    },

    // 可以额外列出不在页面路由里的产物
    nitro: {
        prerender: {
            routes: ['/sitemap.xml', '/robots.txt'],
        },
    },
});`;

const COMMAND_CODE = `# 构建 + 启动本地预览（验证真正的 SSG 产物）
pnpm build
pnpm preview

# 或者生成可直接托管的纯静态站点（输出到 .output/public）
pnpm generate`;

const DATA_CODE = `// 预渲染时执行一次，返回值进入页面 payload
const { data } = await useFetch('/api/catalog');

// 构建完成后，下面这些值都会被冻结：
// - new Date() / Date.now()
// - 随机数与 requestId
// - 依赖请求头的个性化内容`;

const INVALIDATE_CODE = `# 方案 A：内容发布后重新构建（最可靠，适合低频更新）
# 方案 B：部署平台提供 build hook / webhook，发布后自动触发
# 方案 C：只把该路由改成 swr: 60，保留静态形态但允许后台再生`;

const facts = [
    { label: 'HTML 生成时机', value: '构建期（build / generate）' },
    { label: '数据来源', value: 'useFetch 结果写入 payload' },
    { label: '内容更新', value: '重新构建或改为 SWR' },
    { label: '运行时成本', value: '几乎为零，直接发静态文件' },
];

const scenarios = [
    { fit: '适合', text: '产品文档、帮助中心、营销落地页、条款与公告' },
    { fit: '适合', text: '内容按版本发布，更新频率低于每天一次' },
    { fit: '不适合', text: '库存、价格、在线人数等秒级变化的数据' },
    { fit: '不适合', text: '需要按用户身份渲染的页面或共享缓存会串号的内容' },
];

const pitfalls = [
    '开发环境不会按构建期冻结，必须 build 后用 preview 验证。',
    'prerender 页面里的 new Date() 会把构建时间写死，展示“当前时间”会显得很旧。',
    '预渲染请求没有用户的 Cookie / Header，任何个性化逻辑都会退化为公共版本。',
    '构建后新增的动态路径不会被自动生成，需要显式加入 prerender.routes 或改回 SSR。',
];
</script>

<template>
    <DocPage
        title="SSG 静态生成"
        description="SSG 在构建阶段把页面渲染成 HTML 文件，运行时直接返回静态产物。它换来最低的服务器成本，代价是内容被冻结到下一次构建。"
        :tags="['SSG', 'prerender', 'payload', '构建期冻结']"
    >
        <DocSection id="freeze" title="构建期冻结" kicker="01 · FREEZE">
            <p class="body-text">
                预渲染时，Nuxt 会像真实用户一样请求每个路由，执行页面与 <code>useFetch</code>，
                把 HTML 与数据快照写入产物。部署后无论访问多少次，拿到的都是同一份内容。
            </p>
            <DemoCard title="本页的 SSG 画像" desc="当前项目已把 /rendering/ssg 配置为 prerender。" badge="SSG">
                <dl class="stat-grid">
                    <div v-for="item in facts" :key="item.label" class="stat">
                        <dt>{{ item.label }}</dt>
                        <dd class="mono">{{ item.value }}</dd>
                    </div>
                </dl>
            </DemoCard>
            <Callout type="warn" title="dev 与生产行为不同">
                开发服务器仍然按请求渲染，页面里的时间看起来是“实时”的。
                只有执行 <code>pnpm build</code> 后 <code>pnpm preview</code>，才能看到真正冻结的 SSG 行为。
            </Callout>
        </DocSection>

        <DocSection id="enable" title="如何启用" kicker="02 · ENABLE">
            <p class="body-text">
                最细粒度的方式是 <code>routeRules.prerender</code>；也可以在
                <code>nitro.prerender.routes</code> 中补充非页面路由，例如站点地图与 robots。
            </p>
            <CodeBlock :code="CONFIG_CODE" lang="ts" title="nuxt.config.ts" />
            <CodeBlock :code="COMMAND_CODE" lang="text" title="构建与验证" />
            <p class="body-text">
                全站静态化可以设置 <code>nitro.prerender.crawlLinks: true</code>，
                让构建器顺着站内链接抓取；但要确保没有死链，否则构建会因 404 失败。
            </p>
        </DocSection>

        <DocSection id="data" title="数据快照与失效" kicker="03 · DATA">
            <p class="body-text">
                预渲染页面的数据通过 payload 传给客户端，水合时不会再次请求接口。
                这也意味着“数据刷新”完全依赖重新构建。
            </p>
            <CodeBlock :code="DATA_CODE" lang="ts" title="被冻结的数据" />
            <CodeBlock :code="INVALIDATE_CODE" lang="text" title="失效方式" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>失效方式</th><th>生效速度</th><th>成本</th><th>适用</th></tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>重新构建</td>
                            <td>分钟级</td>
                            <td>全站构建</td>
                            <td>版本化内容</td>
                        </tr>
                        <tr>
                            <td>平台 build hook</td>
                            <td>分钟级</td>
                            <td>一次构建</td>
                            <td>CMS 发布事件</td>
                        </tr>
                        <tr>
                            <td>改为 swr: 60</td>
                            <td>秒级到分钟级</td>
                            <td>按路由缓存</td>
                            <td>需要局部更新的公共页</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="scenarios" title="适用场景与坑" kicker="04 · SCENARIOS">
            <p class="body-text">
                SSG 的核心判断是：内容能否接受“发布后才能更新”。
                能接受，就优先静态化；不能接受，就退一步用 SWR，而不是强行全站 SSR。
            </p>
            <ul class="scenario-list">
                <li v-for="item in scenarios" :key="item.text">
                    <span class="badge" :class="item.fit === '适合' ? 'badge--accent' : 'badge--warn'">
                        {{ item.fit }}
                    </span>
                    {{ item.text }}
                </li>
            </ul>
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
    font-size: 13px;
    color: var(--accent);
}

.scenario-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0 0 16px;
    padding: 0;
    list-style: none;
    font-size: 14px;
    color: var(--text-muted);
}

.scenario-list li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
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
