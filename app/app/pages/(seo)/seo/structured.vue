<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const config = useRuntimeConfig();
const route = useRoute();

const siteUrl = config.public.siteUrl;
const siteName = config.public.siteName;

const articleJsonLd = computed(() => ({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: '结构化数据 · Article 与 BreadcrumbList',
    description:
        '使用 useHead 注入 JSON-LD，让搜索引擎理解文章实体与面包屑层级，同时注意转义与 XSS 风险。',
    mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': siteUrl + route.path,
    },
    author: {
        '@type': 'Organization',
        name: siteName,
    },
    publisher: {
        '@type': 'Organization',
        name: siteName,
        logo: {
            '@type': 'ImageObject',
            url: siteUrl + '/logo.png',
        },
    },
    datePublished: '2026-10-30',
    dateModified: '2026-10-30',
}));

const breadcrumbJsonLd = computed(() => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        {
            '@type': 'ListItem',
            position: 1,
            name: '首页',
            item: siteUrl + '/',
        },
        {
            '@type': 'ListItem',
            position: 2,
            name: 'SEO 与元数据',
            item: siteUrl + '/seo',
        },
        {
            '@type': 'ListItem',
            position: 3,
            name: '结构化数据',
            item: siteUrl + route.path,
        },
    ],
}));

useHead({
    script: [
        {
            key: 'ld-article',
            type: 'application/ld+json',
            innerHTML: JSON.stringify(articleJsonLd.value),
        },
        {
            key: 'ld-breadcrumb',
            type: 'application/ld+json',
            innerHTML: JSON.stringify(breadcrumbJsonLd.value),
        },
    ],
});

const TYPES = [
    { type: 'Article', use: '文章、教程、新闻正文', rich: '文章富结果、作者与发布时间' },
    { type: 'BreadcrumbList', use: '站点层级导航', rich: '搜索结果中的面包屑路径' },
    { type: 'Organization', use: '品牌与公司实体', rich: '知识面板、Logo 与社交资料' },
    { type: 'WebSite', use: '站内搜索入口', rich: 'Sitelinks 搜索框' },
    { type: 'FAQPage', use: '常见问答', rich: '问答折叠富结果' },
    { type: 'Product', use: '商品与价格', rich: '价格、库存、评分' },
];

const HEAD_INJECTION_CODE = `const config = useRuntimeConfig();
const route = useRoute();

const articleJsonLd = computed(() => ({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: '结构化数据 · Article 与 BreadcrumbList',
    mainEntityOfPage: config.public.siteUrl + route.path,
    author: { '@type': 'Organization', name: config.public.siteName },
    datePublished: '2026-10-30',
}));

const breadcrumbJsonLd = computed(() => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: config.public.siteUrl + '/' },
        { '@type': 'ListItem', position: 2, name: 'SEO 与元数据', item: config.public.siteUrl + '/seo' },
        { '@type': 'ListItem', position: 3, name: '结构化数据', item: config.public.siteUrl + route.path },
    ],
}));

useHead({
    script: [
        {
            key: 'ld-article',
            type: 'application/ld+json',
            innerHTML: JSON.stringify(articleJsonLd.value),
        },
        {
            key: 'ld-breadcrumb',
            type: 'application/ld+json',
            innerHTML: JSON.stringify(breadcrumbJsonLd.value),
        },
    ],
});`;

const DANGER_CODE = `<!-- ❌ 直接把用户输入拼进 JSON-LD -->
<script type="application/ld+json">
{ "name": "<\/script><script>alert(1)<\/script>" }
<\/script>`;

const SAFE_CODE = `const json = JSON.stringify(articleJsonLd.value);

// 把 < 转成 Unicode 转义，浏览器就不会把它当成标签结束符
const safe = json.replace(/</g, '\\\\u003c');
// 运行时 safe 中的内容形如 {"name":"\\u003c/script\\u003e"}

useHead({
    script: [{ type: 'application/ld+json', innerHTML: safe }],
});`;

const NOTES = [
    'JSON-LD 必须与页面可见内容一致：标注的价格、评分、作者，页面上也要真实存在。',
    '不要用结构化数据标注“隐藏内容”或虚假 FAQ，可能触发人工处罚。',
    '同一个页面可以注入多个 script，但每个实体只声明一次，避免重复与冲突。',
    '用官方富结果测试工具验证，而不是只看 JSON 是否合法。',
    '动态内容（价格、库存、评分）应通过 SSR 输出，或确保抓取时能拿到最新值。',
];
</script>

<template>
    <DocPage
        title="结构化数据"
        description="JSON-LD 用 schema.org 词汇描述页面实体：文章是什么、面包屑有哪些层级。它不直接提升排名，但能让搜索结果更完整，也更容易被 AI 与聚合器理解。"
        :tags="['JSON-LD', 'schema.org', 'Article', 'BreadcrumbList', 'XSS']"
    >
        <DocSection id="why" title="为什么使用 JSON-LD" kicker="01 · WHY">
            <p class="body-text">
                结构化数据有三种写法：Microdata、RDFa、JSON-LD。
                现代站点优先 JSON-LD：它放在
                <code>&lt;script type="application/ld+json"&gt;</code> 中，
                不侵入 HTML 结构，也更容易由程序生成。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>类型</th><th>典型用途</th><th>可能的富结果</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in TYPES" :key="row.type">
                            <td class="mono type-name">{{ row.type }}</td>
                            <td>{{ row.use }}</td>
                            <td>{{ row.rich }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="demo" title="当前页面的 JSON-LD" kicker="02 · LIVE">
            <p class="body-text">
                本页已经通过 <code>useHead</code> 注入 Article 与 BreadcrumbList 两段 JSON-LD。
                下面是实际生成的对象，以及对应的注入代码。查看网页源代码即可在
                <code>&lt;head&gt;</code> 中找到它们。
            </p>
            <DemoCard
                title="Article + BreadcrumbList"
                desc="URL 来自 runtimeConfig.siteUrl 与当前路由，已随 SSR 输出。"
                badge="LIVE"
            >
                <div class="json-grid">
                    <div>
                        <p class="json-label mono">ld-article</p>
                        <pre class="json-out">{{ JSON.stringify(articleJsonLd, null, 2) }}</pre>
                    </div>
                    <div>
                        <p class="json-label mono">ld-breadcrumb</p>
                        <pre class="json-out">{{ JSON.stringify(breadcrumbJsonLd, null, 2) }}</pre>
                    </div>
                </div>
                <CodeBlock :code="HEAD_INJECTION_CODE" lang="ts" title="useHead 注入两段 JSON-LD" />
            </DemoCard>
        </DocSection>

        <DocSection id="security" title="转义与 XSS 注意" kicker="03 · SECURITY">
            <p class="body-text">
                JSON-LD 仍然是页面里的一个 <code>&lt;script&gt;</code> 块。
                如果字符串里出现 <strong>标签结束序列</strong>，浏览器会认为脚本提前结束，
                后面的内容会被当成 HTML 执行。用户可控字段绝不能直接拼接。
            </p>
            <CodeBlock :code="DANGER_CODE" lang="html" title="错误：直接拼接用户输入" />
            <CodeBlock :code="SAFE_CODE" lang="ts" title="正确：序列化后转义尖括号" />
            <Callout type="danger" title="不止 JSON-LD">
                任何把用户输入写进 <code>innerHTML</code>、内联脚本或
                <code>&lt;script&gt;</code> 的场景，都要考虑标签提前闭合与 DOM XSS。
                优先使用 <code>textContent</code> 或框架提供的安全序列化。
            </Callout>
            <Callout type="info" title="用 JSON.stringify 而不是手写字符串">
                <code>JSON.stringify</code> 会正确转义引号、反斜杠与换行；
                再额外处理 <code>&lt;</code> 可以避免标签提前闭合。
            </Callout>
        </DocSection>

        <DocSection id="verify" title="验证与常见错误" kicker="04 · VERIFY">
            <ul class="checklist">
                <li v-for="item in NOTES" :key="item">{{ item }}</li>
            </ul>
            <p class="body-text">
                验证路径：查看网页源代码确认 JSON 存在 → 官方富结果测试工具检查实体 →
                搜索控制台观察增强效果报告。只有最后一步能证明它真的被采用。
            </p>
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
    font-weight: 600;
}

.type-name {
    color: var(--accent);
    font-weight: 600;
}

.json-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 14px;
    margin-bottom: 16px;
}

.json-label {
    margin: 0 0 6px;
    font-size: 11px;
    color: var(--text-faint);
}

.json-out {
    max-height: 360px;
    margin: 0;
    overflow: auto;
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
    font-size: 12px;
    line-height: 1.7;
    white-space: pre;
}

.checklist {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0 0 16px;
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
