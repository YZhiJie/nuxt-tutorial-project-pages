<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const cacheNames = ref<string[]>([]);
const usage = ref(0);
const quota = ref(0);
const supported = ref(false);
const loading = ref(false);
const message = ref('');

const usageText = computed(() =>
    quota.value ? `${formatBytes(usage.value)} / ${formatBytes(quota.value)}` : '—',
);

const percent = computed(() =>
    quota.value ? Math.min(100, Math.round((usage.value / quota.value) * 100)) : 0,
);

function formatBytes(value: number) {
    if (value < 1024) return `${value} B`;
    const units = ['KB', 'MB', 'GB'];
    let size = value / 1024;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
        size /= 1024;
        index += 1;
    }
    return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[index]}`;
}

async function inspect() {
    loading.value = true;
    message.value = '';
    try {
        cacheNames.value = 'caches' in window ? await caches.keys() : [];
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            supported.value = true;
            const estimate = await navigator.storage.estimate();
            usage.value = estimate.usage ?? 0;
            quota.value = estimate.quota ?? 0;
        } else {
            supported.value = false;
            message.value = '当前浏览器不支持 StorageManager.estimate()。';
        }
    } catch (error) {
        message.value = `读取失败：${(error as Error).message}`;
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    void inspect();
});

const PRECACHE_CODE = `// install：只预缓存「离线时也要能用」的资源
const PRECACHE = ['/', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open('static-v1').then((cache) => {
            return Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
        }),
    );
});

// 版本号写进 cache 名称：v1 → v2 时由 activate 清理旧命名空间
// 不要把「用户私有页面」「大体积媒体」放进预缓存列表`;

const FALLBACK_CODE = `self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request));
    } else {
        event.respondWith(cacheFirst(request));
    }
});

async function networkFirst(request) {
    try {
        return await fetch(request);
    } catch {
        return (await caches.match(request))
            ?? (await caches.match('/offline'))
            ?? new Response('离线且无缓存', { status: 503 });
    }
}`;

const SYNC_CODE = `// 注册后台同步：离线时提交的表单先入队
async function queueSubmission(payload) {
    const db = await openDB('outbox', 1);
    await db.add('pending', { payload, createdAt: Date.now() });

    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register('sync-outbox');
}

// SW 侧：网络恢复后浏览器会触发 sync
self.addEventListener('sync', (event) => {
    if (event.tag !== 'sync-outbox') return;
    event.waitUntil(flushOutbox());
});

// 不支持 Background Sync 的浏览器：退化为 online 事件 + 手动重试
window.addEventListener('online', () => void flushOutbox());`;

const fallbackRows = [
    { strategy: '预缓存 Precache', target: '关键 HTML、图标、manifest', when: 'install 阶段', gain: '首屏离线可用', cost: '列表越大安装越慢' },
    { strategy: '网络优先 Network First', target: '文档页导航', when: '每次访问', gain: '在线内容最新', cost: '离线只到上次缓存' },
    { strategy: '缓存优先 Cache First', target: 'JS / CSS / 字体', when: '首次之后', gain: '加载最快', cost: '需内容哈希或版本号' },
    { strategy: '离线兜底 Offline Fallback', target: '未缓存的任意导航', when: '网络失败', gain: '不出现白屏', cost: '兜底页必须内联或预缓存' },
    { strategy: '后台同步 Background Sync', target: '离线写操作', when: '网络恢复', gain: '自动补发', cost: '必须配合幂等键' },
];

const tradeoffRows = [
    { choice: '预缓存整站 HTML', gain: '离线覆盖最完整', risk: '安装慢、占磁盘，内容过期后难以及时纠正' },
    { choice: '只预缓存首页', gain: '安装快', risk: '深层页面离线仍会落到兜底页' },
    { choice: '缓存 API 响应', gain: '弱网下数据秒出', risk: '跨账号串数据，私有内容泄露' },
    { choice: '后台同步写操作', gain: '离线提交不丢', risk: '重复提交，必须用幂等键去重' },
    { choice: '无限期缓存静态资源', gain: '命中率最高', risk: '发布后用户长期停留在旧版本' },
];

const notes = [
    '离线页本身必须能离线使用：内联在 sw.js 中，或与首页一起预缓存，不能只依赖一个在线地址。',
    'Cache Storage 配额由浏览器按 origin 分配，写满后浏览器可能整体清除；大文件不要放入缓存。',
    '用户可在浏览器设置里清除站点数据，离线能力随之消失；不要把「离线可用」当成数据备份。',
    '缓存过期没有自动机制，必须靠版本号、网络优先策略或发布时清理来保证一致性。',
];
</script>

<template>
    <DocPage
        title="离线兜底策略"
        description="离线不是「全部缓存」，而是分层降级：核心资源预缓存、文档网络优先、未命中时落到离线页。本页给出可落地的策略矩阵与取舍。"
        :tags="['预缓存', 'network-first', 'offline fallback', 'Background Sync', '存储配额']"
    >
        <DocSection id="precache" title="预缓存：先把「不能白屏」的资源放进去" kicker="01 · PRECACHE">
            <p class="body-text">
                预缓存发生在 <code>install</code> 阶段，目标是保证离线时至少能打开一个可用的壳。
                列表要克制：只放首页、图标、manifest 这类体积小且必需的资源。
                用 <code>Promise.allSettled</code> 而不是 <code>Promise.all</code>，
                单个资源失败不会让整个安装流程失败。
            </p>
            <CodeBlock :code="PRECACHE_CODE" lang="js" title="install 阶段预缓存" />
            <Callout type="tip" title="版本号就是缓存生命周期">
                cache 名称里的 <code>v1</code> 是人工控制的版本。
                发布新版本时改成 <code>v2</code>，<code>activate</code> 才能安全地删掉旧缓存。
            </Callout>
        </DocSection>

        <DocSection id="fallback" title="分层降级：不同请求不同策略" kicker="02 · FALLBACK">
            <p class="body-text">
                导航请求与静态资源的目标不同：前者要「内容新」，后者要「加载快」。
                因此导航走网络优先，静态资源走缓存优先，两者失败时都要有明确的兜底，
                而不是把异常直接抛给浏览器。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>策略</th><th>作用对象</th><th>生效时机</th><th>收益</th><th>代价</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in fallbackRows" :key="row.strategy">
                            <td>{{ row.strategy }}</td>
                            <td>{{ row.target }}</td>
                            <td>{{ row.when }}</td>
                            <td>{{ row.gain }}</td>
                            <td>{{ row.cost }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="FALLBACK_CODE" lang="js" title="导航与静态资源的分流" />
        </DocSection>

        <DocSection id="sync" title="离线写操作与后台同步" kicker="03 · SYNC">
            <p class="body-text">
                读可以缓存，写不能假设成功。离线提交应先落到本地队列（IndexedDB），
                联网后再由 <code>Background Sync</code> 或 <code>online</code> 事件补发。
                补发必须带幂等键，否则网络抖动会导致重复下单、重复评论。
            </p>
            <CodeBlock :code="SYNC_CODE" lang="ts" title="本地队列 + 后台同步" />
            <Callout type="warn" title="后台同步不是立即执行">
                浏览器会选择合适的时机触发 <code>sync</code>，可能延迟数分钟。
                对时效敏感的操作（支付、抢购）不要依赖它，应提示用户保持在线。
            </Callout>
        </DocSection>

        <DocSection id="tradeoff" title="取舍与观测" kicker="04 · TRADEOFF">
            <p class="body-text">
                每一个离线能力都有成本：安装时间、磁盘占用、数据一致性与版本管理。
                下表的视角不是「哪个更好」，而是「这个收益是否值得这个风险」。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>选择</th><th>收益</th><th>风险</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in tradeoffRows" :key="row.choice">
                            <td>{{ row.choice }}</td>
                            <td>{{ row.gain }}</td>
                            <td>{{ row.risk }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <DemoCard
                title="存储与缓存观测"
                desc="读取当前 origin 的 Cache Storage 名称与配额估算。"
                badge="LIVE"
            >
                <div class="demo-actions">
                    <button type="button" class="btn btn--sm" :disabled="loading" @click="inspect">
                        {{ loading ? '读取中……' : '重新读取' }}
                    </button>
                </div>

                <div class="storage-grid">
                    <div class="storage-item">
                        <span class="storage-label">Cache Storage</span>
                        <span class="storage-value mono">{{ cacheNames.length }} 个</span>
                    </div>
                    <div class="storage-item">
                        <span class="storage-label">已用 / 配额</span>
                        <span class="storage-value mono">{{ usageText }}</span>
                    </div>
                    <div class="storage-item">
                        <span class="storage-label">StorageManager</span>
                        <span class="storage-value mono">{{ supported ? 'available' : 'unavailable' }}</span>
                    </div>
                    <div class="storage-item">
                        <span class="storage-label">持久化状态</span>
                        <span class="storage-value mono">由浏览器决定</span>
                    </div>
                </div>

                <div v-if="quota" class="quota-bar" role="presentation">
                    <span class="quota-fill" :style="{ width: percent + '%' }" />
                </div>

                <ul v-if="cacheNames.length" class="cache-list">
                    <li v-for="name in cacheNames" :key="name" class="mono">{{ name }}</li>
                </ul>
                <p v-else class="hint">还没有缓存空间。可到「Service Worker 实验台」注册后回来观察。</p>
                <p v-if="message" class="hint">{{ message }}</p>

                <template #footer>
                    配额由浏览器按 origin 分配，数值随站点使用量与浏览器策略变化，仅用于观察趋势。
                </template>
            </DemoCard>

            <ul class="checklist">
                <li v-for="item in notes" :key="item">{{ item }}</li>
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

.demo-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.storage-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 14px;
}

.storage-item {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
}

.storage-label {
    font-size: 11px;
    color: var(--text-faint);
}

.storage-value {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    overflow-wrap: anywhere;
}

.quota-bar {
    height: 6px;
    margin-top: 12px;
    border-radius: 999px;
    background: var(--surface-2);
    overflow: hidden;
}

.quota-fill {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: var(--accent);
    transition: width 220ms ease;
}

.cache-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
}

.cache-list li {
    padding: 2px 8px;
    border: 1px solid var(--line);
    border-radius: 6px;
    font-size: 11px;
    color: var(--text-muted);
}

.hint {
    margin: 12px 0 0;
    font-size: 12px;
    line-height: 1.7;
    color: var(--text-faint);
}

@media (max-width: 560px) {
    .storage-grid {
        grid-template-columns: 1fr;
    }
}
</style>

