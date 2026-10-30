<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const LIFECYCLE_CODE = `// public/sw.js —— 注册之后，SW 有独立的生命周期
self.addEventListener('install', (event) => {
    // 预缓存关键资源；不要在这里做耗时超过几秒的事情
    event.waitUntil(precache(['/', '/favicon.svg', '/manifest.webmanifest']));
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        // 删除旧版本缓存，避免磁盘无限增长
        await cleanupOldCaches('v2');
        // 让已打开的页面立即受控
        await self.clients.claim();
    })());
});

// 页面侧注册：只在安全上下文（https / localhost）可用
if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    // reg.installing / reg.waiting / reg.active 对应三段状态
}`;

const STRATEGY_CODE = `// cache-first：静态资源（JS / CSS / 字体 / 图片）
// 先查缓存，命中直接返回；未命中再请求并写入
const hit = await caches.match(request);
if (hit) return hit;
const response = await fetch(request);
await caches.open('static-v1').then((cache) => cache.put(request, response.clone()));
return response;

// network-first：HTML 导航请求
// 先请求网络，成功则更新缓存；失败才回退缓存
try {
    const fresh = await fetch(request);
    await caches.open('pages-v1').then((cache) => cache.put(request, fresh.clone()));
    return fresh;
} catch {
    return (await caches.match(request)) ?? offlineResponse();
}

// stale-while-revalidate：先给旧数据，后台更新
// 适合列表页、头像等「稍旧可接受」的资源
const cached = await caches.match(request);
const revalidate = fetch(request).then((res) => {
    caches.open('swr-v1').then((cache) => cache.put(request, res.clone()));
    return res;
});
return cached ?? revalidate;`;

const MANIFEST_CODE = `{
    "name": "Nuxt 企业工程练功房",
    "short_name": "练功房",
    "start_url": "/",
    "scope": "/",
    "display": "standalone",
    "theme_color": "#0a0a0c",
    "background_color": "#0a0a0c",
    "lang": "zh-CN",
    "icons": [
        {
            "src": "/favicon.svg",
            "sizes": "any",
            "type": "image/svg+xml",
            "purpose": "any maskable"
        }
    ]
}`;

const UPDATE_CODE = `// 1. 检测到新版本：updatefound → installing → installed
registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            // 新 SW 已就绪，但还在等待旧页面全部关闭
            showUpdateBanner();
        }
    });
});

// 2. 用户确认后让它立即接管
registration.waiting?.postMessage({ type: 'SKIP_WAITING' });

// 3. 接管完成的瞬间刷新页面，避免新旧代码混跑
let refreshing = false;
navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
});

// 4. 服务端配合：sw.js 本身必须禁止长缓存
// Cache-Control: no-cache`;

const lifecycleRows = [
    { phase: 'install', when: '首次注册或 sw.js 内容变化', what: '预缓存关键资源', note: '单个资源失败不应让整体 install 失败' },
    { phase: 'waiting', when: '已有旧 SW 控制页面', what: '等待旧页面关闭或 skipWaiting', note: '强制接管会打断正在填写的表单' },
    { phase: 'activate', when: '旧 SW 释放控制权', what: '清理旧缓存、clients.claim()', note: '不要在此时删除仍在用的业务数据' },
    { phase: 'fetch', when: '页面发起同源请求', what: '按策略返回缓存或网络响应', note: '只接管 GET，API 一律放行' },
];

const strategyRows = [
    { name: 'Cache First', scope: 'JS / CSS / 字体 / 图片', pros: '命中即返回，速度最快', cons: '部署后可能拿到旧文件', fit: '带内容哈希的静态资源' },
    { name: 'Network First', scope: 'HTML 导航、时效性内容', pros: '在线时总是最新', cons: '离线时退化为缓存', fit: '文档站、资讯页' },
    { name: 'Stale-While-Revalidate', scope: '列表、头像、配置', pros: '秒开并后台刷新', cons: '首屏可能展示旧数据', fit: '「稍旧可接受」的资源' },
    { name: 'Network Only', scope: 'API、支付、鉴权', pros: '不落盘，不泄露敏感数据', cons: '离线完全不可用', fit: '写操作与身份相关请求' },
];

const manifestRows = [
    { field: 'name / short_name', why: '安装名称与主屏图标下的短名称', rule: 'short_name 建议不超过 12 个字符' },
    { field: 'start_url / scope', why: '启动入口与 SW 控制范围', rule: 'start_url 必须落在 scope 内' },
    { field: 'display', why: '独立窗口或浏览器标签', rule: 'standalone 才会像原生应用' },
    { field: 'theme_color', why: '状态栏与任务切换器配色', rule: '与站点主色保持一致' },
    { field: 'icons', why: '主屏图标与启动画面', rule: '至少一个 192px 与一个 512px，含 maskable' },
];

const pitfalls = [
    'Service Worker 只在 HTTPS 或 localhost 生效；部署到内网 HTTP 时会被浏览器直接拒绝。',
    'sw.js 文件本身不要设置长缓存，否则浏览器永远拿不到新版本。',
    '不要在 fetch 中缓存 /api/ 响应：用户 A 的私有数据可能被返回给用户 B（共享缓存）。',
    '预缓存列表不宜过大：install 阶段阻塞太久，浏览器可能判定失败并终止。',
    '更新提示必须给用户选择权；静默刷新会丢失未提交的表单内容。',
    '离线兜底页要内联在 sw.js 中，不能依赖一个尚未缓存的在线页面。',
];
</script>

<template>
    <DocPage
        title="PWA 与离线"
        description="PWA 不是「加一个 manifest」，而是安装体验、Service Worker 缓存与离线兜底三件事的合体。本模块给出可直接运行的 sw.js 与一套更新策略。"
        :tags="['Service Worker', '缓存策略', 'manifest', '离线兜底', '更新提示']"
    >
        <DocSection id="lifecycle" title="Service Worker 的生命周期" kicker="01 · LIFECYCLE">
            <p class="body-text">
                Service Worker 是一个独立的线程，注册后依次经历
                <code>install → waiting → activate</code>，最后由 <code>fetch</code> 事件接管请求。
                它与页面不是同一份代码，因此升级时旧页面可能仍由旧 SW 控制，
                这正是「刷新后还是旧版本」的根源。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>阶段</th><th>触发时机</th><th>可以做什么</th><th>注意事项</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in lifecycleRows" :key="row.phase">
                            <td class="mono">{{ row.phase }}</td>
                            <td>{{ row.when }}</td>
                            <td>{{ row.what }}</td>
                            <td>{{ row.note }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="LIFECYCLE_CODE" lang="js" title="public/sw.js 与页面注册" />
        </DocSection>

        <DocSection id="strategy" title="缓存策略不是一种" kicker="02 · STRATEGY">
            <p class="body-text">
                同一个站点里，不同资源适合不同策略。判断标准只有两个：
                <strong>资源变化频率</strong>与<strong>离线时能否接受旧值</strong>。
                把全部请求都套用 cache-first，等于把 API 数据也永久冻结在用户设备上。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>策略</th><th>适用资源</th><th>优点</th><th>代价</th><th>适用场景</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in strategyRows" :key="row.name">
                            <td class="mono">{{ row.name }}</td>
                            <td>{{ row.scope }}</td>
                            <td>{{ row.pros }}</td>
                            <td>{{ row.cons }}</td>
                            <td>{{ row.fit }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="STRATEGY_CODE" lang="js" title="三种策略的最小实现" />
            <Callout type="warn" title="缓存键就是隐私边界">
                缓存按 URL 存储，不区分用户。带 Cookie 的接口、按用户渲染的 HTML 一旦被缓存，
                就可能在同一台设备的不同账号之间串数据。接口与鉴权相关请求一律 network-only。
            </Callout>
        </DocSection>

        <DocSection id="manifest" title="manifest 决定安装体验" kicker="03 · MANIFEST">
            <p class="body-text">
                <code>manifest.webmanifest</code> 描述应用名称、启动入口、显示模式与图标。
                它是「可安装」的必要条件之一：还需要 HTTPS、注册 Service Worker，
                以及满足浏览器对图标尺寸与 start_url 的校验。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>字段</th><th>作用</th><th>约束</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in manifestRows" :key="row.field">
                            <td class="mono">{{ row.field }}</td>
                            <td>{{ row.why }}</td>
                            <td>{{ row.rule }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="MANIFEST_CODE" lang="json" title="public/manifest.webmanifest" />
        </DocSection>

        <DocSection id="update" title="更新提示与常见坑" kicker="04 · UPDATE">
            <p class="body-text">
                新版本就绪后，SW 会停在 <code>waiting</code>。正确做法是提示用户「有新版本，是否刷新」，
                用户确认后发送 <code>SKIP_WAITING</code>，并在 <code>controllerchange</code> 时刷新一次。
                强制静默接管，会让正在编辑表单的用户丢失输入。
            </p>
            <CodeBlock :code="UPDATE_CODE" lang="ts" title="新版本检测与平滑接管" />
            <ul class="checklist">
                <li v-for="item in pitfalls" :key="item">{{ item }}</li>
            </ul>
            <Callout type="tip" title="本地怎么验证">
                打开浏览器开发者工具的 Application → Service Workers，
                勾选 Update on reload 与 Offline 模拟，再配合本模块的「Service Worker 实验台」逐项操作。
            </Callout>
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

.body-text strong {
    color: var(--text);
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
    padding-left: 24px;
    font-size: 14px;
    line-height: 1.7;
    color: var(--text-muted);
}

.checklist li::before {
    content: '→';
    position: absolute;
    left: 0;
    color: var(--accent);
    font-family: var(--font-mono);
}
</style>

