export default defineNuxtConfig({
    modules: ['@pinia/nuxt'],

    css: ['~/assets/css/main.css'],

    // 组件按业务目录拆分后仍使用原名（不做目录前缀）
    components: [{ path: '~/components', pathPrefix: false }],

    // 支持 composables 子目录自动导入
    imports: {
        dirs: ['composables/**'],
    },

    // 支持 stores 子目录自动导入（app/stores/auth/lab）
    pinia: {
        storesDirs: ['stores/**'],
    },

    runtimeConfig: {
        // 仅服务端可见（生产用 NUXT_API_SECRET 覆盖）
        apiSecret: 'dev-secret',
        public: {
            siteName: 'Nuxt 企业工程练功房',
            siteUrl: 'http://localhost:3000',
        },
    },

    routeRules: {
        // 管理后台纯客户端渲染示例
        '/admin/**': { ssr: false },

        // 渲染策略示例：静态预渲染 / 增量再生
        '/rendering/ssg': { prerender: true },
        '/rendering/isr': { swr: 60 },

        // 安全模块的响应头示例：dev 与 build 都会生效
        '/security/headers': {
            headers: {
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'Referrer-Policy': 'strict-origin-when-cross-origin',
                'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
            },
        },

        // 静态资源长缓存
        '/_nuxt/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    },

    // Nitro KV 存储：dev 下也能落盘到 .data/kv
    nitro: {
        storage: {
            data: {
                driver: 'fs',
                base: './.data/kv',
            },
        },
    },

    app: {
        head: {
            htmlAttrs: { lang: 'zh-CN' },
            meta: [
                { name: 'viewport', content: 'width=device-width, initial-scale=1' },
                { name: 'theme-color', content: '#0a0a0c' },
                { name: 'format-detection', content: 'telephone=no' },
            ],
            link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
        },
    },

    devtools: { enabled: true },
    compatibilityDate: '2025-07-15',
});
