export default defineNuxtConfig({
    modules: ['@pinia/nuxt'],
    css: ['~/assets/css/main.css'],
    runtimeConfig: {
        // 仅服务端可见的密钥（生产用 NUXT_API_SECRET 覆盖）
        apiSecret: 'dev-secret',
        public: {
            siteName: 'Nuxt LearnHub',
        },
    },
    routeRules: {
        // 管理后台纯客户端渲染
        '/admin/**': { ssr: false },
    },
    // Nitro KV 存储：dev 下不配也能跑（默认内存），配了生产构建更稳
    nitro: {
        storage: {
            data: {
                driver: 'fs',
                base: './.data/kv',
            },
        },
    },
    devtools: { enabled: true },
    compatibilityDate: '2025-07-15',
});
