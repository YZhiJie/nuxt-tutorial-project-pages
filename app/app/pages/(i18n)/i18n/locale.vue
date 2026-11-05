<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const { locale, setLocale, toggleLocale, t, formatDate, formatCurrency } = useLocale();

useHead({
    htmlAttrs: { lang: computed(() => (locale.value === 'zh' ? 'zh-CN' : 'en')) },
});

const PUBLISHED_AT = '2026-10-30T09:00:00+08:00';
const PRICE = 1299;

const displayName = computed(() => (locale.value === 'zh' ? '工程师' : 'Engineer'));

const dateRows = computed(() => [
    {
        label: locale.value === 'zh' ? '完整日期' : 'Full date',
        value: formatDate(PUBLISHED_AT, { dateStyle: 'full' }),
    },
    {
        label: locale.value === 'zh' ? '短日期' : 'Short date',
        value: formatDate(PUBLISHED_AT, { dateStyle: 'short' }),
    },
    {
        label: locale.value === 'zh' ? '日期 + 时间' : 'Date + time',
        value: formatDate(PUBLISHED_AT, { dateStyle: 'medium', timeStyle: 'short' }),
    },
]);

const alternates = computed(() => [
    { hreflang: 'zh-CN', href: '/zh/i18n/locale', active: locale.value === 'zh' },
    { hreflang: 'en', href: '/en/i18n/locale', active: locale.value === 'en' },
    { hreflang: 'x-default', href: '/i18n/locale', active: false },
]);

const simulated = ref('');

function simulate(href: string) {
    simulated.value = href;
}

const PREFIX_CODE = `// 页面文件不放在语言目录里，语言是运行时 / 构建期的「同一页面多版本」
app/pages/(i18n)/i18n/locale.vue  →  /i18n/locale

// 方案 A：默认语言无前缀
//   /i18n/locale        → zh-CN
//   /en/i18n/locale     → en
// 中间件把「无前缀」补成默认语言，把未知前缀 301 到正确地址
export default defineEventHandler((event) => {
    const path = event.path;
    const isLocalized = /^\\/(zh|en)\\//.test(path);
    if (isLocalized) return;

    const cookie = getCookie(event, 'locale');
    const browser = getHeader(event, 'accept-language');
    const target = negotiate(browser, ['zh', 'en'], cookie ?? 'zh');
    if (target !== 'zh') {
        return sendRedirect(event, '/' + target + path, 302);
    }
});`;

const ACCEPT_CODE = `Accept-Language: zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7

// 解析步骤
// 1. 按逗号切分，读取 ;q= 权重（缺省为 1）
// 2. 按 q 从高到低排序
// 3. 用前缀匹配站点支持的语言（zh-CN → zh）
// 4. 全部不匹配时返回默认语言

// 注意
// - q=0 表示「明确不接受」，要排除
// - 不要只取第一个语言标签：用户可能把不支持的方言排在前面
// - 协商结果写入 Cookie 后用 302 跳到对应 URL，保证 URL 与内容一致`;

const MESSAGES_CODE = `const MESSAGES = {
    zh: {
        'hero.greeting': '你好，{name}',
        'label.date': '发布日期',
        'unit.daysAgo': '{count} 天前',
    },
    en: {
        'hero.greeting': 'Hello, {name}',
        'label.date': 'Published',
        'unit.daysAgo': '{count} days ago',
    },
};

// t(key, params) 的责任边界
// 1. 查表：当前语言 → 默认语言 → key 本身
// 2. 插值：只替换 {name} 这类占位符，不做 HTML 拼接
// 3. 格式化：日期 / 货币 / 相对时间交给 Intl，不拼字符串

export function useLocale() {
    const locale = useState<'zh' | 'en'>('docs-locale', () => 'zh');
    const intlLocale = computed(() => (locale.value === 'zh' ? 'zh-CN' : 'en-US'));

    function t(key: string, params: Record<string, string | number> = {}) {
        const template = MESSAGES[locale.value][key] ?? MESSAGES.zh[key] ?? key;
        return Object.entries(params).reduce(
            (text, [name, value]) => text.replaceAll('{' + name + '}', String(value)),
            template,
        );
    }

    function formatDate(value: Date | string, options?: Intl.DateTimeFormatOptions) {
        return new Intl.DateTimeFormat(intlLocale.value, options).format(new Date(value));
    }

    return { locale, t, formatDate };
}`;

const pitfalls = [
    '语言状态用 useState 而不是模块级 ref：SSR 下每个请求都有独立作用域。',
    '切换语言后要同步 URL 与 Cookie，否则刷新页面会回到协商结果。',
    'hreflang 必须双向互指，且包含 x-default；canonical 只指向当前语言自己。',
    '货币不要只换符号：金额、税率、小数位都可能随区域不同。',
];
</script>

<template>
    <DocPage
        title="多语言路由"
        description="语言是 URL 的一部分。本页用一个可切换的 useLocale 演示消息插值、Intl 格式化与 hreflang 生成，并解释前缀策略与 Accept-Language 协商。"
        :tags="['前缀策略', 'Accept-Language', 'useState', 'hreflang', 'Intl']"
    >
        <DocSection id="prefix" title="前缀策略：语言必须可索引" kicker="01 · PREFIX">
            <p class="body-text">
                最常用的组合是「默认语言无前缀 + 其他语言带前缀」：默认语言 URL 最短，
                其他语言有稳定、可分享、可被搜索引擎收录的地址。
                无前缀请求由服务端中间件补成默认语言，未知前缀一律 301，避免同一内容出现多个地址。
            </p>
            <CodeBlock :code="PREFIX_CODE" lang="ts" title="前缀中间件与重定向" />
        </DocSection>

        <DocSection id="accept" title="Accept-Language 协商" kicker="02 · ACCEPT">
            <p class="body-text">
                浏览器会把用户偏好按 q 值排序发送。服务端只取前几个标签做前缀匹配，
                匹配失败就落到默认语言。协商结果应写入 Cookie，并在用户手动切换时以 Cookie 为准。
            </p>
            <CodeBlock :code="ACCEPT_CODE" lang="text" title="请求头解析" />
            <Callout type="warn" title="协商不等于切换">
                协商只发生在「用户还没做过选择」时。用户点过 English 之后，
                再用浏览器语言把他拉回中文，是最常见的体验事故。
            </Callout>
        </DocSection>

        <DocSection id="composable" title="useLocale 的实现" kicker="03 · COMPOSABLE">
            <p class="body-text">
                这个演示不依赖第三方 i18n 模块：<code>useState</code> 保存语言，
                消息表负责文案，<code>Intl</code> 负责日期与货币。
                关键是让「查表、插值、格式化」三件事各司其职。
            </p>
            <CodeBlock :code="MESSAGES_CODE" lang="ts" title="app/composables/i18n/useLocale.ts" />
        </DocSection>

        <DocSection id="demo" title="切换语言，观察格式变化" kicker="04 · DEMO">
            <p class="body-text">
                下面的切换器直接调用 <code>useLocale</code> 的 <code>setLocale</code>。
                注意文案来自消息表、日期与货币来自 <code>Intl</code>，
                代码里没有一处手写「年月日」或货币符号。
            </p>
            <DemoCard
                title="语言切换器"
                desc="切换 zh / en，观察文案、日期、货币与模拟 hreflang 的变化。"
                badge="LIVE"
            >
                <div class="locale-switch" role="group" aria-label="语言切换">
                    <button
                        type="button"
                        class="btn btn--sm"
                        :class="{ 'btn--ghost': locale !== 'zh' }"
                        :aria-pressed="locale === 'zh'"
                        @click="setLocale('zh')"
                    >
                        中文 · zh
                    </button>
                    <button
                        type="button"
                        class="btn btn--sm"
                        :class="{ 'btn--ghost': locale !== 'en' }"
                        :aria-pressed="locale === 'en'"
                        @click="setLocale('en')"
                    >
                        English · en
                    </button>
                    <button type="button" class="btn btn--ghost btn--sm" @click="toggleLocale">
                        快速切换
                    </button>
                </div>

                <div class="translation-card">
                    <p class="translation-kicker mono">{{ t('site.title') }}</p>
                    <p class="translation-greeting">{{ t('hero.greeting', { name: displayName }) }}</p>
                    <p class="translation-desc">{{ t('hero.desc') }}</p>
                </div>

                <div class="meta-grid">
                    <div class="meta-item">
                        <span class="meta-label">{{ t('label.locale') }}</span>
                        <span class="meta-value mono">{{ locale }} · {{ t('nav.docs') }}</span>
                    </div>
                    <div v-for="row in dateRows" :key="row.label" class="meta-item">
                        <span class="meta-label">{{ row.label }}</span>
                        <span class="meta-value mono">{{ row.value }}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">{{ t('label.price') }}</span>
                        <span class="meta-value mono">{{ formatCurrency(PRICE) }}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">CNY 固定币种</span>
                        <span class="meta-value mono">{{ formatCurrency(PRICE, 'CNY') }}</span>
                    </div>
                </div>

                <div class="alt-block">
                    <p class="alt-title">
                        模拟 hreflang
                        <span class="faint">（当前页面实际地址固定为 /i18n/locale）</span>
                    </p>
                    <a
                        v-for="item in alternates"
                        :key="item.hreflang"
                        :href="item.href"
                        class="alt-link"
                        :class="{ 'alt-link--active': item.active }"
                        @click.prevent="simulate(item.href)"
                    >
                        <span class="badge" :class="{ 'badge--accent': item.active }">{{ item.hreflang }}</span>
                        <span class="mono">{{ item.href }}</span>
                    </a>
                </div>

                <p class="demo-note">
                    html lang 会同步为
                    <code>{{ locale === 'zh' ? 'zh-CN' : 'en' }}</code>，
                    与当前语言保持一致。
                </p>

                <template #footer>
                    {{ simulated ? `模拟跳转到 ${simulated}（本页未部署语言前缀路由）` : '点击任一 hreflang 条目可查看目标地址；切换语言只影响当前演示状态。' }}
                </template>
            </DemoCard>
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

.locale-switch {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.translation-card {
    margin-top: 14px;
    padding: 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
}

.translation-kicker {
    margin: 0 0 6px;
    font-size: 11px;
    color: var(--text-faint);
    letter-spacing: 0.06em;
}

.translation-greeting {
    margin: 0 0 6px;
    font-size: 22px;
    font-weight: 700;
    color: var(--accent);
}

.translation-desc {
    margin: 0;
    font-size: 13px;
    line-height: 1.7;
    color: var(--text-muted);
}

.meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 10px;
    margin-top: 14px;
}

.meta-item {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 10px 12px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
}

.meta-label {
    font-size: 11px;
    color: var(--text-faint);
}

.meta-value {
    font-size: 12px;
    color: var(--text);
}

.alt-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
}

.alt-title {
    margin: 0 0 4px;
    font-size: 12px;
    font-weight: 600;
}

.alt-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 8px;
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-muted);
    transition: background 140ms ease, color 140ms ease;
}

.alt-link:hover {
    background: var(--surface-2);
    color: var(--text);
}

.alt-link--active {
    background: var(--accent-soft);
    color: var(--accent);
}

.demo-note {
    margin: 14px 0 0;
    font-size: 12px;
    color: var(--text-muted);
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

