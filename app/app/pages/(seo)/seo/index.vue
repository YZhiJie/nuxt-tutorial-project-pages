<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const CRAWL_STEPS = [
    { step: '发现 URL', detail: '站内链接、sitemap.xml、外部引用', failure: '孤岛页面、没有 sitemap、链接失效' },
    { step: '抓取', detail: '遵守 robots.txt，读取状态码与响应头', failure: '被 robots 拦截、403 / 500、超时' },
    { step: '渲染', detail: '优先读取 SSR 返回的完整 HTML', failure: '关键内容只在客户端渲染，抓取时为空' },
    { step: '索引', detail: '去重、选择 canonical、理解结构化数据', failure: '多 URL 指向同一内容、canonical 缺失' },
    { step: '展示', detail: '用 title / description / 结构化数据生成摘要', failure: '标题重复、描述缺失、富结果不生效' },
];

const META_ROWS = [
    { tag: 'title', rule: '每页唯一，≤ 60 字符', source: 'useSeoMeta / useDocMeta' },
    { tag: 'description', rule: '120–160 字符，概括页面价值', source: 'useSeoMeta' },
    { tag: 'canonical', rule: '绝对 URL，指向唯一正式地址', source: 'useHead link' },
    { tag: 'og:*', rule: '分享卡片：标题、描述、1200×630 图片', source: 'useSeoMeta' },
    { tag: 'robots', rule: '按需 noindex / nofollow', source: 'routeRules 或 useSeoMeta' },
    { tag: 'hreflang', rule: '多语言页面互指', source: 'useHead link' },
];

const META_CODE = `// 页面级元数据：静态值
useSeoMeta({
    title: '元数据 API · Nuxt 企业工程练功房',
    description: '用 useSeoMeta 为每个路由生成唯一标题、描述与社交分享卡片。',
});

// 动态值：配合 computed / ref，随页面状态更新
const product = await fetchProduct(id);

useSeoMeta({
    title: () => product.value.name,
    description: () => product.value.summary,
    ogImage: () => product.value.cover,
});`;

const FILES = [
    { name: 'sitemap.xml', role: '告诉搜索引擎有哪些 URL、最后修改时间与优先级', how: 'Nuxt Sitemap 模块或服务端路由动态生成' },
    { name: 'robots.txt', role: '声明抓取范围与 sitemap 地址', how: '服务端路由 /public 静态文件，按环境区分' },
    { name: 'manifest.webmanifest', role: 'PWA 名称、图标、主题色与启动方式', how: 'public 静态文件或 @vite-pwa/nuxt 生成' },
    { name: 'llms.txt', role: '给 AI 爬虫 / 助手提供结构化站点说明', how: '服务端路由或构建时生成纯文本' },
    { name: 'JSON-LD', role: '用结构化数据描述 Article、Breadcrumb 等实体', how: 'useHead 注入 script[type="application/ld+json"]' },
];

const CHECKLIST = [
    '每个路由都有唯一 title 与 description，且能在查看源代码中看到。',
    'canonical 指向正式域名的绝对 URL，而不是 localhost 或带查询参数的地址。',
    '关键内容由 SSR 输出；不要依赖客户端 JS 才出现的正文。',
    'sitemap 只包含 200 状态、可索引的正式 URL；robots 不误拦静态资源。',
    '结构化数据与页面可见内容一致，不承诺页面上不存在的信息。',
    '发布前用 curl 或搜索引擎调试工具验证 HTML head 与状态码。',
];
</script>

<template>
    <DocPage
        title="SEO 与元数据"
        description="SEO 的目标不是“堆关键词”，而是让搜索引擎能发现、抓取、理解并正确展示每个页面。Nuxt 的 SSR、元数据 API 与文件约定，构成了这条链路的工程基础。"
        :tags="['抓取原理', '元数据', 'canonical', '结构化数据', 'sitemap', 'robots']"
    >
        <DocSection id="crawl" title="抓取与索引的基本链路" kicker="01 · CRAWL">
            <p class="body-text">
                搜索引擎按“发现 → 抓取 → 渲染 → 索引 → 展示”五步工作。
                工程侧能控制的是每一步的可见性与一致性：页面要能被发现、能返回 200、
                能直接读到内容、有明确的规范地址。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>阶段</th><th>发生什么</th><th>常见失败</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in CRAWL_STEPS" :key="row.step">
                            <td class="step">{{ row.step }}</td>
                            <td>{{ row.detail }}</td>
                            <td>{{ row.failure }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <Callout type="info" title="SSR 不是 SEO 的全部，但它是起点">
                客户端渲染的内容并非完全不可抓取，但渲染预算有限、时机不确定。
                对内容站来说，让关键正文出现在初始 HTML 中，永远是最稳的策略。
            </Callout>
        </DocSection>

        <DocSection id="metadata" title="元数据：每页的唯一身份" kicker="02 · METADATA">
            <p class="body-text">
                title 与 description 决定搜索结果里的标题与摘要，canonical 决定重复内容
                归并到哪个 URL。它们必须由页面自身声明，而不是全站共用一份。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>标签</th><th>规则</th><th>来源</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in META_ROWS" :key="row.tag">
                            <td class="mono">{{ row.tag }}</td>
                            <td>{{ row.rule }}</td>
                            <td class="mono">{{ row.source }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="META_CODE" lang="ts" title="useSeoMeta 静态与动态用法" />
            <p class="body-text">
                可实时修改 head 的演示见
                <NuxtLink to="/seo/metadata" class="inline-link">元数据 API</NuxtLink>。
            </p>
        </DocSection>

        <DocSection id="structured" title="结构化数据与文件约定" kicker="03 · STRUCTURED">
            <p class="body-text">
                结构化数据帮助搜索引擎理解“这是什么内容”，文件约定则帮助它发现与约束抓取。
                两者都不直接提升排名，但能改善展示效果与抓取效率。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>文件 / 数据</th><th>作用</th><th>生成方式</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in FILES" :key="row.name">
                            <td class="mono">{{ row.name }}</td>
                            <td>{{ row.role }}</td>
                            <td>{{ row.how }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="grid grid--two">
                <NuxtLink to="/seo/metadata" class="next-link">
                    <span class="mono">LIVE</span>
                    <span>元数据 API 与实时 head</span>
                </NuxtLink>
                <NuxtLink to="/seo/structured" class="next-link">
                    <span class="mono">LIVE</span>
                    <span>JSON-LD 结构化数据</span>
                </NuxtLink>
                <NuxtLink to="/seo/files" class="next-link">
                    <span class="mono">DOCS</span>
                    <span>sitemap / robots / manifest / llms.txt</span>
                </NuxtLink>
            </div>
        </DocSection>

        <DocSection id="checklist" title="上线检查单" kicker="04 · CHECKLIST">
            <ul class="checklist">
                <li v-for="item in CHECKLIST" :key="item">{{ item }}</li>
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

.step {
    font-weight: 600;
    color: var(--accent);
    white-space: nowrap;
}

.inline-link {
    color: var(--accent);
    border-bottom: 1px dashed var(--accent);
}

.next-link {
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

.next-link:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
}

.next-link .mono {
    color: var(--accent);
    font-size: 11px;
    letter-spacing: 0.08em;
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
    content: '✓';
    position: absolute;
    left: 0;
    top: 0;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 11px;
}
</style>
