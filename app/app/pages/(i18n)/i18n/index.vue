<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const NEGOTIATION_CODE = `// 语言来源按优先级从高到低
// 1. URL 前缀：用户显式选择的落地页，最可靠、可分享、可被搜索收录
//    /zh/docs  /en/docs
// 2. Cookie / localStorage：上一次的选择，避免每次回退到浏览器语言
//    cookie: locale=en; path=/; max-age=31536000
// 3. Accept-Language：浏览器偏好，用 q 值排序后匹配可用语言
//    Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
// 4. 地域 / 站点默认：最终兜底，必须存在且可预测
//    fallbackLocale = 'zh'

// Accept-Language 的最小解析（服务端中间件）
function negotiate(header: string | undefined, supported: string[], fallback: string) {
    if (!header) return fallback;
    return header
        .split(',')
        .map((part) => {
            const [tag, q] = part.trim().split(';q=');
            return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
        })
        .sort((a, b) => b.q - a.q)
        .map((item) => supported.find((lang) => item.tag.startsWith(lang)))
        .find(Boolean) ?? fallback;
}`;

const MESSAGE_CODE = `// locales/zh.ts —— 消息按业务域分组，不按页面堆成平铺列表
export default {
    common: {
        save: '保存',
        cancel: '取消',
        retry: '重试',
    },
    docs: {
        title: '文档中心',
        updatedAt: '更新于 {date}',
        empty: '暂无内容',
    },
    billing: {
        price: '每月 {amount} 元',
        seats: '{count} 个席位',
    },
};

// 使用：t('docs.updatedAt', { date: '2026-10-30' })
// 不要用整句作为 key：'更新于 {date}' 一旦改文案，所有语言都要跟着改 key

// 插值只做「变量替换」，不要在其中拼 HTML
// 复数、性别、日期区间等复杂语法交给 Intl.PluralRules / ICU 消息格式`;

const ROUTING_CODE = `// 方案 A：前缀 + 默认语言无前缀（prefix_except_default）
//   /docs       → zh（默认，canonical 稳定）
//   /en/docs    → en
// 方案 B：所有语言都带前缀（prefix）
//   /zh/docs    /en/docs
// 方案 C：无前缀 + Cookie（no_prefix）
//   /docs?lang=en 或 cookie 切换，URL 不体现语言，SEO 弱
// 方案 D：独立域名 / 子域（domain）
//   zh.example.com  en.example.com

// 每种语言页面都要输出自引用 canonical + 全量 hreflang
useHead({
    link: [
        { rel: 'canonical', href: 'https://example.com' + route.fullPath },
        ...alternates.value.map((item) => ({
            rel: 'alternate',
            hreflang: item.hreflang,
            href: item.href,
        })),
    ],
});`;

const HREFLANG_CODE = `<!-- 每个语言版本在 head 中声明全部语言版本，包括自己 -->
<link rel="alternate" hreflang="zh-CN" href="https://example.com/zh/docs" />
<link rel="alternate" hreflang="en" href="https://example.com/en/docs" />
<link rel="alternate" hreflang="x-default" href="https://example.com/docs" />

<!-- 规则 -->
<!-- 1. hreflang 必须双向互指，A 指向 B，B 也要指向 A -->
<!-- 2. 语言用 BCP 47：zh-CN / zh-Hant / en / ja -->
<!-- 3. x-default 指向语言选择页或默认版本 -->
<!-- 4. canonical 只能指向当前语言自己，不能把 en 页面 canonical 到 zh -->
<!-- 5. 地址必须绝对 URL，且最终返回 200（不要指向重定向链） -->`;

const sources = [
    { source: 'URL 前缀 / 子域', example: '/en/docs', priority: '最高', why: '用户显式选择，可分享、可索引' },
    { source: 'Cookie / localStorage', example: 'locale=en', priority: '次高', why: '记住上次选择，减少跳转' },
    { source: 'Accept-Language', example: 'zh-CN,zh;q=0.9,en;q=0.8', priority: '中', why: '首次访问的合理猜测' },
    { source: '地域 / 站点默认', example: 'zh', priority: '兜底', why: '必须是稳定可预测的值' },
];

const strategies = [
    { name: 'prefix_except_default', url: '/docs、/en/docs', pros: '默认语言 URL 最短，canonical 稳定', cons: '需要区分「默认语言」与「未选择」', fit: '大多数企业官网 / 文档站' },
    { name: 'prefix', url: '/zh/docs、/en/docs', pros: '规则统一，语言永远显式', cons: '默认语言也被加前缀，旧链接需重定向', fit: '多语言并列、无绝对主语言' },
    { name: 'no_prefix', url: '/docs?lang=en', pros: 'URL 结构不变', cons: '搜索引擎难以区分语言版本', fit: '内部系统、登录后产品' },
    { name: 'domain', url: 'zh.example.com、en.example.com', pros: '地域与品牌隔离最彻底', cons: '证书、部署、权重分散成本高', fit: '跨区域独立运营的站点' },
];

const formatRows = [
    { type: '日期', api: 'Intl.DateTimeFormat', example: '2026年10月30日 / October 30, 2026' },
    { type: '数字', api: 'Intl.NumberFormat', example: '1,299 / 1.299' },
    { type: '货币', api: 'Intl.NumberFormat(style: currency)', example: '¥1,299.00 / $1,299.00' },
    { type: '相对时间', api: 'Intl.RelativeTimeFormat', example: '3 天前 / 3 days ago' },
    { type: '复数', api: 'Intl.PluralRules', example: '1 item / 2 items' },
];

const pitfalls = [
    '不要在模板里硬编码中文标点与日期格式，统一走消息表与 Intl。',
    '语言切换必须落到具体 URL，而不是只改内存状态；否则分享出去的链接仍是默认语言。',
    '消息表缺失 key 要有回退与告警，静默空白最难排查。',
    'hreflang 与 canonical 是两套规则：前者声明互译关系，后者声明唯一主版本。',
    '数字、货币、百分比不要手工拼接字符串，符号位置与千分位因语言而异。',
];
</script>

<template>
    <DocPage
        title="国际化"
        description="国际化不是「把中文翻成英文」，而是语言协商、消息组织、路由策略与格式化的一整套约定。本模块从 URL 到像素逐层拆解。"
        :tags="['语言协商', '消息表', '路由前缀', 'Intl', 'hreflang']"
    >
        <DocSection id="negotiation" title="语言协商：谁决定用户看到哪种语言" kicker="01 · NEGOTIATION">
            <p class="body-text">
                语言来源有优先级。最可靠的是 URL：它既是用户的选择，也是可分享、可被搜索引擎收录的事实。
                Cookie 只用于「记住上次选择」，<code>Accept-Language</code> 只用于首次访问的猜测，
                站点默认语言则是永远存在的兜底。不要用 IP 地域直接决定语言，跨境办公与 VPN 都会误判。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>来源</th><th>示例</th><th>优先级</th><th>作用</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in sources" :key="row.source">
                            <td>{{ row.source }}</td>
                            <td class="mono">{{ row.example }}</td>
                            <td>{{ row.priority }}</td>
                            <td>{{ row.why }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="NEGOTIATION_CODE" lang="ts" title="协商顺序与 Accept-Language 解析" />
            <Callout type="tip" title="协商结果要可覆盖">
                自动协商只是默认值。用户手动切换后，必须写入 Cookie 并跳转到对应语言 URL，
                后续访问以用户选择为准，不再被浏览器语言反复拉回。
            </Callout>
        </DocSection>

        <DocSection id="messages" title="消息组织：key 的命名与插值" kicker="02 · MESSAGES">
            <p class="body-text">
                消息表应按业务域分组，key 用 <code>模块.语义</code> 两层结构。整句中文不要做 key：
                文案一改，所有语言都要改名。插值保持极简，只做变量替换；
                复数、性别、日期区间这类语法差异交给 <code>Intl</code> 或 ICU 消息格式。
            </p>
            <CodeBlock :code="MESSAGE_CODE" lang="ts" title="locales/zh.ts" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>类型</th><th>推荐 API</th><th>输出示例</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in formatRows" :key="row.type">
                            <td>{{ row.type }}</td>
                            <td class="mono">{{ row.api }}</td>
                            <td>{{ row.example }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="routing" title="路由策略：语言放在 URL 的哪里" kicker="03 · ROUTING">
            <p class="body-text">
                语言必须体现在可被索引的 URL 上。四种主流策略的核心差异在于
                <strong>默认语言是否带前缀</strong>、<strong>是否使用独立域名</strong>。
                策略一旦上线就难以更改，务必在建站初期确定，并为旧地址准备 301。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>策略</th><th>URL 示例</th><th>优点</th><th>代价</th><th>适用</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in strategies" :key="row.name">
                            <td class="mono">{{ row.name }}</td>
                            <td class="mono">{{ row.url }}</td>
                            <td>{{ row.pros }}</td>
                            <td>{{ row.cons }}</td>
                            <td>{{ row.fit }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="ROUTING_CODE" lang="ts" title="四种策略与元数据联动" />
        </DocSection>

        <DocSection id="hreflang" title="hreflang 总览与常见错误" kicker="04 · HREFLANG">
            <p class="body-text">
                <code>hreflang</code> 告诉搜索引擎「这些页面是同一内容的不同语言版本」。
                它与 <code>canonical</code> 不是替代关系：canonical 声明唯一主版本，
                hreflang 声明互译关系。两者都写错，最常见的后果是语言版本被合并或互相竞争。
            </p>
            <CodeBlock :code="HREFLANG_CODE" lang="html" title="head 中的语言声明" />
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

.body-text strong {
    color: var(--text);
}

.checklist {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 16px 0 0;
    padding: 0;
    list-style: none;
}

.checklist li {
    position: relative;
    padding-left: 24px;
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.7;
}

.checklist li::before {
    content: '→';
    position: absolute;
    left: 0;
    color: var(--accent);
    font-family: var(--font-mono);
}
</style>
