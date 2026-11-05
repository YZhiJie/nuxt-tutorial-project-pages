export type Locale = 'zh' | 'en';

const INTL_LOCALE: Record<Locale, string> = {
    zh: 'zh-CN',
    en: 'en-US',
};

/**
 * 演示用消息表：真实项目按语言拆文件，构建期静态导入。
 * key 用「模块.语义」两层命名，避免把整句中文塞进 key。
 */
const MESSAGES: Record<Locale, Record<string, string>> = {
    zh: {
        'site.title': '企业级 Nuxt 工程知识站',
        'nav.docs': '文档中心',
        'hero.greeting': '你好，{name}',
        'hero.desc': '用一个知识站，串起 Nuxt 的服务端、客户端与工程化实践。',
        'label.locale': '当前语言',
        'label.date': '发布日期',
        'label.price': '订阅价格',
        'label.updated': '最近更新',
        'unit.daysAgo': '{count} 天前',
    },
    en: {
        'site.title': 'Enterprise Nuxt Knowledge Site',
        'nav.docs': 'Documentation',
        'hero.greeting': 'Hello, {name}',
        'hero.desc': 'One knowledge site that connects Nuxt server, client and engineering practice.',
        'label.locale': 'Current locale',
        'label.date': 'Published',
        'label.price': 'Subscription price',
        'label.updated': 'Last updated',
        'unit.daysAgo': '{count} days ago',
    },
};

/**
 * 轻量国际化：useState 保存语言，消息表 + Intl 格式化。
 * 刻意不引入第三方 i18n 模块，便于理解协商、消息与格式化的最小闭环。
 */
export function useLocale() {
    const locale = useState<Locale>('docs-locale', () => 'zh');

    const intlLocale = computed(() => INTL_LOCALE[locale.value]);

    function setLocale(next: Locale) {
        locale.value = next;
    }

    function toggleLocale() {
        locale.value = locale.value === 'zh' ? 'en' : 'zh';
    }

    /**
     * 取消息并做 {name} 插值；缺失 key 时先回退中文，再回退 key 本身，
     * 让漏翻译在界面上显式暴露，而不是渲染成空白。
     */
    function t(key: string, params: Record<string, string | number> = {}) {
        const template = MESSAGES[locale.value][key] ?? MESSAGES.zh[key] ?? key;
        return Object.entries(params).reduce(
            (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
            template,
        );
    }

    function formatDate(
        value: Date | number | string,
        options: Intl.DateTimeFormatOptions = { dateStyle: 'long' },
    ) {
        return new Intl.DateTimeFormat(intlLocale.value, options).format(new Date(value));
    }

    function formatCurrency(amount: number, currency?: string) {
        const code = currency ?? (locale.value === 'zh' ? 'CNY' : 'USD');
        return new Intl.NumberFormat(intlLocale.value, {
            style: 'currency',
            currency: code,
            maximumFractionDigits: 2,
        }).format(amount);
    }

    function formatRelative(days: number) {
        return new Intl.RelativeTimeFormat(intlLocale.value, { numeric: 'auto' }).format(-days, 'day');
    }

    return { locale, intlLocale, setLocale, toggleLocale, t, formatDate, formatCurrency, formatRelative };
}
