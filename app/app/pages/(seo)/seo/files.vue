<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const FILE_ROWS = [
    {
        name: 'sitemap.xml',
        role: '列出可索引的正式 URL、最后修改时间与抓取提示',
        how: '服务端路由动态生成，或使用 Sitemap 模块',
        note: '只放 200 状态、无参数污染的 URL',
    },
    {
        name: 'robots.txt',
        role: '声明抓取范围、屏蔽路径与 sitemap 地址',
        how: 'public/ 静态文件或服务端路由按环境生成',
        note: '不要误拦 CSS / JS / 图片',
    },
    {
        name: 'manifest.webmanifest',
        role: 'PWA 名称、图标、主题色与启动方式',
        how: 'public/ 静态文件，或交给 PWA 模块生成',
        note: '图标至少 192 与 512 两种尺寸',
    },
    {
        name: 'llms.txt',
        role: '给 AI 爬虫与助手提供站点说明与核心链接',
        how: '服务端路由或构建时生成纯文本',
        note: '非标准协议，按社区约定保持简洁',
    },
    {
        name: 'favicon / apple-touch-icon',
        role: '浏览器与移动端主屏图标',
        how: 'public/ 静态文件并在 head 声明',
        note: '准备多尺寸，避免浏览器缩放模糊',
    },
];

const SITEMAP_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2026-10-30</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/observability</loc>
    <lastmod>2026-10-30</lastmod>
  </url>
  <url>
    <loc>https://example.com/seo/metadata</loc>
    <lastmod>2026-10-30</lastmod>
  </url>
</urlset>`;

const SITEMAP_CODE = `// server/routes/sitemap.xml.ts
export default defineEventHandler(async (event) => {
    setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8');

    const urls = await listPublicUrls();

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls.map((url) => \`<url><loc>\${url}</loc></url>\`),
        '</urlset>',
    ].join('');
});`;

const ROBOTS_SAMPLE = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: https://example.com/sitemap.xml`;

const ROBOTS_CODE = `// server/routes/robots.txt.ts
export default defineEventHandler((event) => {
    const config = useRuntimeConfig();
    setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8');

    return [
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        \`Sitemap: \${config.public.siteUrl}/sitemap.xml\`,
    ].join('\\n');
});`;

const MANIFEST_SAMPLE = `{
  "name": "Nuxt 企业工程练功房",
  "short_name": "Nuxt 知识站",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0c",
  "theme_color": "#4ea8ff",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}`;

const LLMS_SAMPLE = `# Nuxt 企业工程练功房

> 面向企业的 Nuxt 4 工程知识站，覆盖路由、渲染、数据、安全、可观测性、性能与 SEO。

## 核心页面
- [可观测性](https://example.com/observability)
- [性能优化](https://example.com/performance)
- [SEO 与元数据](https://example.com/seo)

## 说明
- 内容以 SSR HTML 输出，欢迎抓取与引用。
- 请勿抓取 /api/ 下的接口。`;

const RULES = [
    'sitemap 中的 URL 必须是正式域名、绝对地址，且与 canonical 保持一致。',
    '不要把分页、筛选、排序产生的重复 URL 全部塞进 sitemap；用 canonical 归并。',
    'robots.txt 是“抓取指令”不是“隐藏内容”工具：被 Disallow 的页面仍可能被外部链接索引。',
    '生产环境与预览环境的 robots 要区分，预览站通常应整体 noindex。',
    'manifest 与图标路径要能被公开访问，不要放在需要鉴权的目录下。',
    'llms.txt 目前是社区约定，不要把它当成官方标准或排名手段。',
];

const CHECKLIST = [
    '访问 /sitemap.xml、/robots.txt、/manifest.webmanifest、/llms.txt 均返回 200 与正确 content-type。',
    'sitemap 中抽样的 URL 打开后 canonical 指向自身，且不是 404 / 重定向链。',
    'robots.txt 的 Sitemap 地址可访问，且与生产域名一致。',
    'manifest 的图标全部可加载，尺寸与声明一致。',
    '预览环境有 X-Robots-Tag: noindex 或 robots 全站 Disallow。',
];
</script>

<template>
    <DocPage
        title="文件约定"
        description="sitemap、robots、manifest 与 llms.txt 不是“可选项”，而是站点对抓取方与客户端的公开契约。本页说明每个文件的作用、生成方式与示例内容。"
        :tags="['sitemap.xml', 'robots.txt', 'manifest', 'llms.txt', '服务端路由']"
    >
        <DocSection id="matrix" title="四个文件的分工" kicker="01 · MATRIX">
            <p class="body-text">
                这些文件都通过固定路径暴露站点元信息。它们的内容必须与真实路由一致，
                而不是构建后手工维护的另一份清单。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>文件</th><th>作用</th><th>生成方式</th><th>注意</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in FILE_ROWS" :key="row.name">
                            <td class="mono file-name">{{ row.name }}</td>
                            <td>{{ row.role }}</td>
                            <td>{{ row.how }}</td>
                            <td>{{ row.note }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <Callout type="info" title="模块还是服务端路由">
                生产项目常用 <code>@nuxtjs/sitemap</code> 自动收集路由。
                本项目不新增依赖，示例统一用 Nitro 服务端路由，
                便于理解文件到底由谁生成、返回什么。
            </Callout>
        </DocSection>

        <DocSection id="sitemap" title="sitemap.xml 与 robots.txt" kicker="02 · SITEMAP & ROBOTS">
            <p class="body-text">
                sitemap 帮助搜索引擎发现深层页面；robots 告诉它哪些路径不必抓。
                两者是配合关系：robots 控制抓取，canonical 与 sitemap 控制索引与去重。
            </p>
            <CodeBlock :code="SITEMAP_SAMPLE" lang="xml" title="sitemap.xml 示例" />
            <CodeBlock :code="SITEMAP_CODE" lang="ts" title="服务端动态生成 sitemap" />
            <CodeBlock :code="ROBOTS_SAMPLE" lang="text" title="robots.txt 示例" />
            <CodeBlock :code="ROBOTS_CODE" lang="ts" title="按环境生成 robots" />
            <Callout type="warn" title="robots 不能替代鉴权">
                <code>Disallow</code> 只约束遵守协议的爬虫，不阻止任何人直接访问 URL。
                真正的私有内容必须靠服务端鉴权。
            </Callout>
        </DocSection>

        <DocSection id="manifest" title="manifest 与 llms.txt" kicker="03 · MANIFEST & LLMS">
            <p class="body-text">
                <code>manifest.webmanifest</code> 决定站点被安装到主屏后的名称、图标与主题色；
                <code>llms.txt</code> 则用纯文本告诉 AI 工具“这个站点是什么、核心页面在哪”。
                两者成本很低，但能显著改善机器可读性。
            </p>
            <CodeBlock :code="MANIFEST_SAMPLE" lang="json" title="manifest.webmanifest" />
            <CodeBlock :code="LLMS_SAMPLE" lang="text" title="llms.txt 示例" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>原则</th><th>说明</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>可访问</td><td>固定路径、无鉴权、返回正确 content-type</td></tr>
                        <tr><td>可缓存</td><td>低频变化，允许 CDN 缓存但要有合理的 TTL</td></tr>
                        <tr><td>与真实站点一致</td><td>名称、图标、URL 与页面实际内容保持一致</td></tr>
                        <tr><td>可验证</td><td>发布流程中自动检查 200 状态与关键字段</td></tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="rules" title="易错点" kicker="04 · RULES">
            <ul class="checklist">
                <li v-for="item in RULES" :key="item">{{ item }}</li>
            </ul>
        </DocSection>

        <DocSection id="checklist" title="发布检查单" kicker="05 · CHECKLIST">
            <ul class="checklist checklist--ok">
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

.file-name {
    color: var(--accent);
    font-weight: 600;
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

.checklist--ok li::before {
    content: '✓';
    background: var(--accent-soft);
    color: var(--accent);
}
</style>
