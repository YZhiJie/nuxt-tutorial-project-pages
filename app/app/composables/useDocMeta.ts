/**
 * 文档页 SEO 元信息：标题模板、描述、Open Graph 与 canonical。
 * 所有模块页面统一调用，保证每个路由都有唯一标题。
 */
export function useDocMeta(options: {
    title: string;
    description?: string;
    type?: 'website' | 'article';
}) {
    const config = useRuntimeConfig();
    const route = useRoute();
    const siteName = config.public.siteName;

    const fullTitle = computed(() => `${options.title} · ${siteName}`);
    const description = options.description ?? `${options.title}：Nuxt 4 企业级工程实践示例。`;
    const canonical = computed(() => {
        const base = config.public.siteUrl;
        return `${base.replace(/\/$/, '')}${route.path}`;
    });

    useSeoMeta({
        title: fullTitle,
        description,
        ogTitle: fullTitle,
        ogDescription: description,
        ogType: options.type ?? 'article',
        ogSiteName: siteName,
        twitterCard: 'summary',
        twitterTitle: fullTitle,
        twitterDescription: description,
    });

    useHead({
        link: [{ rel: 'canonical', href: canonical }],
    });
}
