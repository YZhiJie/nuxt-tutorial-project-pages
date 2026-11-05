/**
 * 商品目录接口：用于演示 SWR / ISR 的缓存窗口。
 * 公共数据可被 CDN 共享 60 秒，期间返回同一份快照。
 */
const ITEMS = [
    { id: 'nuxt-pro', name: 'Nuxt Pro 年度授权', price: 199 },
    { id: 'nitro-node', name: 'Nitro Node 部署包', price: 89 },
    { id: 'ui-kit', name: '企业组件库', price: 299 },
    { id: 'audit-suite', name: '安全审计套件', price: 399 },
];

export default defineEventHandler((event) => {
    setResponseHeader(event, 'cache-control', 'public, s-maxage=60');

    return {
        generatedAt: new Date().toISOString(),
        version: 'v2026.10.30',
        items: ITEMS,
    };
});
