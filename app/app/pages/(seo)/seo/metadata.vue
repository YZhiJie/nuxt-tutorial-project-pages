<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const DEFAULT_TITLE = '元数据 API · Nuxt 企业工程练功房';
const DEFAULT_DESCRIPTION =
    'useSeoMeta 把标题、描述、Open Graph 与 canonical 统一声明在页面里，既能在 SSR 时写进初始 HTML，也能在客户端随状态更新。';

const demoTitle = ref(DEFAULT_TITLE);
const demoDescription = ref(DEFAULT_DESCRIPTION);
const headSnapshot = ref({ title: '—', description: '—' });

useSeoMeta({
    title: demoTitle,
    description: demoDescription,
    ogTitle: demoTitle,
    ogDescription: demoDescription,
});

function syncHeadSnapshot() {
    if (!import.meta.client) return;
    headSnapshot.value = {
        title: document.title,
        description:
            document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
    };
}

watch([demoTitle, demoDescription], () => {
    if (!import.meta.client) return;
    document.title = demoTitle.value;
    const descriptionTag = document.querySelector('meta[name="description"]');
    if (descriptionTag) descriptionTag.setAttribute('content', demoDescription.value);
    syncHeadSnapshot();
});

onMounted(syncHeadSnapshot);

function resetDemo() {
    demoTitle.value = DEFAULT_TITLE;
    demoDescription.value = DEFAULT_DESCRIPTION;
}

const STATIC_CODE = `// 静态值：直接写在页面 setup 里
useSeoMeta({
    title: '元数据 API · Nuxt 企业工程练功房',
    description: '每个路由唯一的标题与描述。',
    ogTitle: '元数据 API',
    ogDescription: '社交分享卡片标题与描述。',
});`;

const DYNAMIC_CODE = `// 动态值：用 ref / computed，随数据变化自动更新 head
const article = ref({ title: '加载中…', summary: '' });

useSeoMeta({
    title: () => article.value.title,
    description: () => article.value.summary,
    ogTitle: () => article.value.title,
    ogDescription: () => article.value.summary,
    ogImage: () => article.value.cover,
});

// 数据到达后无需手动操作 DOM，unhead 会同步标签`;

const SSR_CODE = `// 服务端渲染时，useSeoMeta 会把标签写进返回的 HTML
useSeoMeta({
    title: '文章标题 · 站点名',
    description: '文章摘要，供搜索结果展示。',
});

// 浏览器“查看源代码”应看到（而不是只在 Elements 面板里）
// <head>
//   <title>文章标题 · 站点名</title>
//   <meta name="description" content="文章摘要，供搜索结果展示。">
// </head>`;

const CANONICAL_CODE = `// canonical 必须是绝对 URL，且每个页面唯一
const config = useRuntimeConfig();
const route = useRoute();

const canonical = computed(() => config.public.siteUrl + route.path);

useHead({
    link: [{ rel: 'canonical', href: canonical }],
});

// 多语言页面还要输出 hreflang 互指
// <link rel="alternate" hreflang="en" href="https://example.com/en/...">`;

const NOTES = [
    'title 不要堆关键词：每页唯一、具体、可读，长度控制在 60 字符左右。',
    'description 不是 meta keywords 的替代品；它决定搜索结果的摘要，值得逐页打磨。',
    'SSR 下不要用 onMounted 才改 head：首屏 HTML 已经发出，爬虫与分享卡片读不到。',
    'canonical 要指向正式域名；带 utm 参数、分页、排序参数的 URL 需要明确归并规则。',
    'OG 图片建议 1200×630，并提供绝对 URL；否则分享平台可能抓不到。',
];
</script>

<template>
    <DocPage
        title="元数据 API"
        description="useSeoMeta 把标题、描述、Open Graph 与 canonical 统一声明在页面里，既能在 SSR 时写进初始 HTML，也能在客户端随状态更新。下面的演示会实时改写本页 head。"
        :tags="['useSeoMeta', 'useHead', 'canonical', 'Open Graph', 'SSR']"
    >
        <DocSection id="static" title="静态与动态用法" kicker="01 · API">
            <p class="body-text">
                <code>useSeoMeta</code> 是 <code>useHead</code> 的语义化封装：
                字段名直接对应 SEO 标签（<code>ogTitle</code> → <code>og:title</code>）。
                传入普通值就是静态元数据，传入 ref / computed / getter 就是动态元数据。
            </p>
            <CodeBlock :code="STATIC_CODE" lang="ts" title="静态元数据" />
            <CodeBlock :code="DYNAMIC_CODE" lang="ts" title="动态元数据" />
            <Callout type="tip" title="一个页面只声明一次">
                页面级元数据应由页面自己负责。布局或组件里重复声明同名标签，
                会产生覆盖与顺序问题；需要兜底时，用统一 composable 收口。
            </Callout>
        </DocSection>

        <DocSection id="live" title="实时改写 head" kicker="02 · LIVE">
            <p class="body-text">
                修改下面的输入框，页面标题与 description 会立即更新。
                右侧展示的是浏览器当前真实的
                <code>document.title</code> 与 <code>meta[name="description"]</code>，
                而不是组件里的临时变量。
            </p>
            <DemoCard
                title="head 实时预览"
                desc="输入会同步到本页 head；离开页面后由路由元数据重新接管。"
                badge="LIVE"
            >
                <div class="editor">
                    <label class="field">
                        <span class="field-label">title</span>
                        <input v-model="demoTitle" class="input" type="text" maxlength="80">
                    </label>
                    <label class="field">
                        <span class="field-label">description</span>
                        <textarea v-model="demoDescription" class="textarea" rows="3" maxlength="200" />
                    </label>
                </div>

                <div class="snapshot">
                    <p class="snapshot-title">当前 head（client 读取）</p>
                    <dl class="snapshot-grid">
                        <div>
                            <dt class="mono">document.title</dt>
                            <dd>{{ headSnapshot.title || '—' }}</dd>
                        </div>
                        <div>
                            <dt class="mono">meta[name="description"]</dt>
                            <dd>{{ headSnapshot.description || '—' }}</dd>
                        </div>
                    </dl>
                </div>

                <template #footer>
                    <div class="demo-actions">
                        <button class="btn btn--sm btn--ghost" type="button" @click="resetDemo">
                            恢复默认
                        </button>
                        <span class="faint">此演示会临时覆盖本页标题，离开页面后恢复。</span>
                    </div>
                </template>
            </DemoCard>
        </DocSection>

        <DocSection id="ssr" title="为什么必须服务端渲染" kicker="03 · SSR">
            <p class="body-text">
                搜索引擎、社交平台的抓取器大多只读取初始 HTML，不执行或只有限执行 JS。
                如果标题与描述是 <code>onMounted</code> 之后才写入，首屏 HTML 里就是空的，
                抓取器看到的内容与用户看到的完全不同。
            </p>
            <CodeBlock :code="SSR_CODE" lang="ts" title="SSR 输出应包含完整 head" />
            <Callout type="warn" title="检查方式：看源代码，而不是 Elements">
                浏览器开发者工具的 Elements 面板显示的是执行 JS 后的 DOM。
                用“查看网页源代码”或 <code>curl</code> 才能确认抓取器真正拿到的 head。
            </Callout>
        </DocSection>

        <DocSection id="canonical" title="canonical 与常见错误" kicker="04 · CANONICAL">
            <p class="body-text">
                canonical 解决重复内容：同一个内容有多个 URL 时，告诉搜索引擎哪个是正式地址。
                它必须绝对、稳定，并且与 sitemap 中的 URL 一致。
            </p>
            <CodeBlock :code="CANONICAL_CODE" lang="ts" title="canonical 与 hreflang" />
            <ul class="checklist">
                <li v-for="item in NOTES" :key="item">{{ item }}</li>
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

.editor {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.field-label {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    color: var(--text-faint);
}

.snapshot {
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
}

.snapshot-title {
    margin: 0 0 10px;
    font-size: 11px;
    color: var(--text-faint);
}

.snapshot-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
    margin: 0;
}

.snapshot-grid > div {
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
}

.snapshot-grid dt {
    font-size: 11px;
    color: var(--text-faint);
}

.snapshot-grid dd {
    margin: 6px 0 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--accent);
    word-break: break-word;
}

.demo-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
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
