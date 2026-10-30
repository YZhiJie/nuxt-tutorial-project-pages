/* Service Worker：静态资源 cache-first，导航请求 network-first，离线内联兜底。 */
const VERSION = 'v1';
const STATIC_CACHE = `static-${VERSION}`;
const PAGE_CACHE = `pages-${VERSION}`;

const PRECACHE_URLS = ['/', '/favicon.svg', '/manifest.webmanifest'];

const OFFLINE_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>当前离线 · Nuxt 练功房</title>
<style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 32px; box-sizing: border-box; background: #0b0f10; color: #e6edf3; font-family: ui-sans-serif, system-ui, -apple-system, "PingFang SC", sans-serif; }
    main { max-width: 460px; }
    p { color: #9aa7b2; line-height: 1.75; }
    code { color: #00dc82; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
</style>
</head>
<body>
<main>
    <h1>当前离线</h1>
    <p>网络不可用，且这个页面还没有被缓存。已访问过的文档页在离线时仍可打开。</p>
    <p><code>Service Worker</code> 正在后台等待网络恢复，联网后刷新即可。</p>
</main>
</body>
</html>`;

self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(STATIC_CACHE);
            await Promise.allSettled(
                PRECACHE_URLS.map(async (url) => {
                    try {
                        await cache.add(new Request(url, { cache: 'reload' }));
                    } catch {
                        // 单个资源预缓存失败不应让整个 install 失败
                    }
                }),
            );
            // 首次安装没有旧页面时浏览器会自动激活；
            // 更新时保留 waiting 状态，由用户确认后再 SKIP_WAITING。
        })(),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys
                    // 只清理本 SW 的命名空间，避免影响同域其他应用
                    .filter(
                        (key) =>
                            (key.startsWith('static-') || key.startsWith('pages-')) &&
                            !key.endsWith(VERSION),
                    )
                    .map((key) => caches.delete(key)),
            );
            await self.clients.claim();
        })(),
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // 只接管 GET；POST / PUT 直连网络
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // 接口与分片请求不缓存，避免返回过期数据
    if (url.pathname.startsWith('/api/')) return;
    if (request.headers.get('range')) return;

    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request));
        return;
    }

    if (url.pathname.startsWith('/_nuxt/') || /\.(css|js|mjs|woff2?|svg|png|jpg|jpeg|webp|ico)$/.test(url.pathname)) {
        event.respondWith(cacheFirst(request));
    }
});

async function networkFirst(request) {
    const cache = await caches.open(PAGE_CACHE);
    try {
        const response = await fetch(request);
        if (response.ok) {
            await cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await cache.match(request);
        if (cached) return cached;

        const staticCache = await caches.open(STATIC_CACHE);
        const home = await staticCache.match('/');
        if (home) return home;

        return new Response(OFFLINE_HTML, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
    }
}

async function cacheFirst(request) {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            await cache.put(request, response.clone());
        }
        return response;
    } catch {
        // 静态资源完全不可用：返回空响应，由页面自行处理加载失败
        return new Response('', { status: 504, statusText: 'Offline' });
    }
}
