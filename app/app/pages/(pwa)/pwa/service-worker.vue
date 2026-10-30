<script setup lang="ts">
definePageMeta({ layout: 'docs' });

useHead({
    link: [{ rel: 'manifest', href: '/manifest.webmanifest' }],
});

type Status = 'checking' | 'unsupported' | 'unregistered' | 'registering' | 'registered' | 'failed';

const supported = ref(false);
const insecure = ref(false);
const status = ref<Status>('checking');
const workerState = ref('—');
const scope = ref('');
const controlled = ref(false);
const waiting = ref(false);
const online = ref(true);
const busy = ref(false);
const message = ref('');
const cacheNames = ref<string[]>([]);
const refreshing = ref(false);

let registration: ServiceWorkerRegistration | null = null;
const boundRegistrations = new WeakSet<ServiceWorkerRegistration>();

const statusTone = computed(() => {
    if (status.value === 'failed' || status.value === 'unsupported') return 'bad';
    if (status.value === 'registered') return 'ok';
    return 'idle';
});

const statusLabel = computed(() => {
    const labels: Record<Status, string> = {
        checking: '检测中',
        unsupported: '不支持',
        unregistered: '未注册',
        registering: '注册中',
        registered: '已注册',
        failed: '注册失败',
    };
    return labels[status.value];
});

function syncFromRegistration(reg: ServiceWorkerRegistration | null) {
    registration = reg;
    if (!reg) {
        workerState.value = '—';
        scope.value = '';
        waiting.value = false;
        return;
    }
    scope.value = reg.scope;
    const worker = reg.active ?? reg.waiting ?? reg.installing;
    workerState.value = worker?.state ?? '—';
    waiting.value = Boolean(reg.waiting);
    controlled.value = Boolean(navigator.serviceWorker.controller);
}

function bindUpdate(reg: ServiceWorkerRegistration) {
    if (boundRegistrations.has(reg)) return;
    boundRegistrations.add(reg);
    reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
            workerState.value = worker.state;
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                waiting.value = true;
                message.value = '发现新版本：新 Service Worker 已进入 waiting，等待页面关闭或确认接管。';
            }
        });
    });
}

async function refreshCaches() {
    if (!('caches' in window)) return;
    try {
        cacheNames.value = await caches.keys();
    } catch {
        cacheNames.value = [];
    }
}

async function register() {
    if (busy.value || !supported.value) return;
    busy.value = true;
    status.value = 'registering';
    message.value = '正在下载并安装 /sw.js……';
    try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
            updateViaCache: 'none',
        });
        bindUpdate(reg);
        syncFromRegistration(reg);
        await navigator.serviceWorker.ready;
        status.value = 'registered';
        controlled.value = Boolean(navigator.serviceWorker.controller);
        message.value = controlled.value
            ? '注册成功，当前页面已由 Service Worker 接管。'
            : '注册成功；刷新一次后当前页面才会被接管。';
        await refreshCaches();
    } catch (error) {
        status.value = 'failed';
        message.value = `注册失败：${(error as Error).message}`;
    } finally {
        busy.value = false;
    }
}

async function unregister() {
    if (busy.value) return;
    busy.value = true;
    message.value = '正在注销……';
    try {
        const reg = registration ?? (await navigator.serviceWorker.getRegistration());
        if (!reg) {
            status.value = 'unregistered';
            message.value = '当前没有已注册的 Service Worker。';
            return;
        }
        const removed = await reg.unregister();
        syncFromRegistration(null);
        status.value = 'unregistered';
        message.value = removed
            ? '已注销。当前页面仍然受控制，刷新后才会真正解除。'
            : '注销未生效，请刷新页面后重试。';
    } catch (error) {
        message.value = `注销失败：${(error as Error).message}`;
    } finally {
        busy.value = false;
    }
}

function applyUpdate() {
    const waitingWorker = registration?.waiting;
    if (!waitingWorker) {
        message.value = '当前没有等待中的新版本。';
        return;
    }
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    message.value = '已发送 SKIP_WAITING，等待控制权切换。';
}

async function clearCaches() {
    if (!('caches' in window)) {
        message.value = '当前环境不支持 Cache Storage。';
        return;
    }
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    cacheNames.value = [];
    message.value = `已清理 ${keys.length} 个缓存空间。`;
}

function handleControllerChange() {
    controlled.value = Boolean(navigator.serviceWorker.controller);
    workerState.value = registration?.active?.state ?? workerState.value;
    message.value = refreshing.value
        ? '控制权已切换。'
        : '控制权已切换：新版本 Service Worker 已接管。';
    void refreshCaches();
}

function handleOnline() {
    online.value = true;
}

function handleOffline() {
    online.value = false;
}

onMounted(async () => {
    online.value = navigator.onLine;
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    insecure.value = !window.isSecureContext;

    if (!('serviceWorker' in navigator)) {
        supported.value = false;
        status.value = 'unsupported';
        await refreshCaches();
        return;
    }

    supported.value = true;
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
            bindUpdate(reg);
            syncFromRegistration(reg);
            status.value = 'registered';
        } else {
            status.value = 'unregistered';
        }
    } catch {
        status.value = 'unregistered';
    }

    await refreshCaches();
});

onBeforeUnmount(() => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
});

const REGISTER_CODE = `// 页面侧：注册 + 等待就绪
if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',            // 只能缩小，不能超出 sw.js 所在目录
        updateViaCache: 'none',
    });

    // ready 在首次安装并激活后 resolve
    await navigator.serviceWorker.ready;
    console.log('页面是否受控：', Boolean(navigator.serviceWorker.controller));
}

// 作用域规则
// /sw.js        → 最大 scope 为 /
// /pwa/sw.js    → 最大 scope 为 /pwa/
// 想控制全站，sw.js 必须放在根目录并以 /sw.js 提供`;

const CLEANUP_CODE = `// 注销：只解除注册，不会立刻让当前页面失去控制
const registration = await navigator.serviceWorker.getRegistration();
await registration?.unregister();

// 缓存清理：按 cache 名称批量删除
const keys = await caches.keys();
await Promise.all(keys.map((key) => caches.delete(key)));

// 只删本项目命名空间的缓存，避免误删同域其他应用的缓存
const ours = keys.filter((key) => key.startsWith('static-') || key.startsWith('pages-'));
await Promise.all(ours.map((key) => caches.delete(key)));`;

const UPDATE_CODE = `// 新版本就绪 → 提示 → 用户确认 → 接管
registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            // 新版本停在 waiting，旧页面仍由旧版本控制
            updateReady.value = true;
        }
    });
});

registration.waiting?.postMessage({ type: 'SKIP_WAITING' });

navigator.serviceWorker.addEventListener('controllerchange', () => {
    // 生产环境在这里 location.reload()，并加锁避免重复刷新
});`;

const stateRows = [
    { status: 'unregistered', meaning: '尚未注册或已注销', action: '可点击「注册 Service Worker」' },
    { status: 'registering', meaning: '正在下载与安装 sw.js', action: '等待 register() 完成' },
    { status: 'registered', meaning: '注册成功，存在 active 或 waiting', action: '可注销、清缓存、触发更新' },
    { status: 'waiting', meaning: '新版本已安装，等待旧页面释放', action: '发送 SKIP_WAITING 后刷新' },
    { status: 'controlled', meaning: '当前页面已由 SW 接管', action: '同源 GET 请求会经过 fetch 策略' },
];

const notes = [
    '注册只在 https 或 localhost 生效；普通 http 域名下 navigator.serviceWorker 直接不可用。',
    'serviceWorker.controller 为空不代表注册失败：首次注册后要刷新一次页面才会被接管。',
    '注销不会立刻释放当前页面；旧页面会继续由旧 SW 控制直到关闭或刷新。',
    '缓存空间按 origin 共享，清理时只删除本项目前缀的 cache，避免影响同域其他应用。',
    '调试期间可在开发者工具勾选 Bypass for network，临时绕过 SW 缓存，避免被旧资源干扰。',
];
</script>

<template>
    <DocPage
        title="Service Worker 实验台"
        description="在本页真实注册 public/sw.js，观察安装状态、页面控制权与 Cache Storage。所有操作都在当前浏览器内完成，刷新后状态仍然存在。"
        :tags="['navigator.serviceWorker', 'scope', 'Cache Storage', 'SKIP_WAITING']"
    >
        <DocSection id="register" title="注册与作用域" kicker="01 · REGISTER">
            <p class="body-text">
                注册入口必须放在根路径，否则作用域会被限制在子目录。
                <code>/sw.js</code> 的最大作用域是 <code>/</code>，而
                <code>/pwa/sw.js</code> 只能控制 <code>/pwa/</code> 下的请求。
                注册时用 <code>updateViaCache: 'none'</code>，避免浏览器按 HTTP 缓存判断 sw.js 是否变化。
            </p>
            <CodeBlock :code="REGISTER_CODE" lang="ts" title="注册与作用域规则" />
            <Callout type="info" title="安全上下文是硬门槛">
                Service Worker 依赖 HTTPS（localhost 例外）。在内网 HTTP 环境下，
                <code>navigator.serviceWorker</code> 可能直接不存在，这不是代码写错了。
            </Callout>
        </DocSection>

        <DocSection id="machine" title="状态机与实验台" kicker="02 · STATE">
            <p class="body-text">
                注册成功只是起点。页面是否被接管取决于 <code>controller</code>，
                新版本是否可切换取决于 <code>registration.waiting</code>。
                下面五个状态是排查「为什么没生效」时最该先看的。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>状态</th><th>含义</th><th>下一步</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in stateRows" :key="row.status">
                            <td class="mono">{{ row.status }}</td>
                            <td>{{ row.meaning }}</td>
                            <td>{{ row.action }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <DemoCard
                title="Service Worker 实验台"
                desc="真实注册 /sw.js，观察状态、控制权与缓存空间。"
                badge="LIVE"
            >
                <div class="env-row">
                    <span class="env-chip" :class="supported ? 'env--ok' : 'env--bad'">
                        {{ supported ? 'API 可用' : 'API 不可用' }}
                    </span>
                    <span class="env-chip" :class="controlled ? 'env--ok' : 'env--idle'">
                        {{ controlled ? '页面已受控' : '页面未受控' }}
                    </span>
                    <span class="env-chip" :class="online ? 'env--ok' : 'env--warn'">
                        {{ online ? '在线' : '离线' }}
                    </span>
                </div>

                <div class="demo-actions">
                    <button
                        type="button"
                        class="btn btn--sm"
                        :disabled="busy || !supported"
                        @click="register"
                    >
                        {{ busy && status === 'registering' ? '注册中……' : '注册 Service Worker' }}
                    </button>
                    <button
                        type="button"
                        class="btn btn--ghost btn--sm"
                        :disabled="busy || status === 'unregistered' || !supported"
                        @click="unregister"
                    >
                        注销
                    </button>
                    <button
                        type="button"
                        class="btn btn--ghost btn--sm"
                        :disabled="!waiting"
                        @click="applyUpdate"
                    >
                        让新版本接管
                    </button>
                    <button type="button" class="btn btn--ghost btn--sm" @click="clearCaches">
                        清空缓存
                    </button>
                    <button type="button" class="btn btn--ghost btn--sm" @click="refreshCaches">
                        刷新缓存列表
                    </button>
                </div>

                <p v-if="insecure" class="hint hint--warn">
                    当前不是安全上下文：请使用 https 或 localhost 访问，否则无法注册。
                </p>

                <div class="status-grid">
                    <div class="status-item">
                        <span class="status-label">注册状态</span>
                        <span class="status-value" :class="`tone--${statusTone}`">{{ statusLabel }}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Worker 状态</span>
                        <span class="status-value mono">{{ workerState }}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">controller</span>
                        <span class="status-value mono">{{ controlled ? 'active' : 'null' }}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">waiting</span>
                        <span class="status-value mono">{{ waiting ? 'yes' : 'no' }}</span>
                    </div>
                    <div class="status-item status-item--wide">
                        <span class="status-label">scope</span>
                        <span class="status-value mono">{{ scope || '—' }}</span>
                    </div>
                </div>

                <div class="cache-block">
                    <div class="cache-head">
                        <span class="cache-title">Cache Storage</span>
                        <span class="badge">{{ cacheNames.length }} 个</span>
                    </div>
                    <ul v-if="cacheNames.length" class="cache-list">
                        <li v-for="name in cacheNames" :key="name" class="mono">{{ name }}</li>
                    </ul>
                    <p v-else class="hint">暂无缓存空间。注册后首次 install 会创建 static-v1。</p>
                </div>

                <p v-if="message" class="message" :class="`message--${statusTone}`">{{ message }}</p>

                <template #footer>
                    <span v-if="!supported">
                        浏览器不支持 Service Worker 或当前非安全上下文；本页仍可阅读文档，但无法演示。
                    </span>
                    <span v-else-if="!controlled">
                        注册成功但 controller 为空是正常的：刷新一次页面后才会被接管。
                    </span>
                    <span v-else>
                        当前页面已受控：同源 GET 请求会先经过 sw.js 的 fetch 事件。
                    </span>
                </template>
            </DemoCard>
        </DocSection>

        <DocSection id="cleanup" title="注销与缓存清理" kicker="03 · CLEANUP">
            <p class="body-text">
                <code>unregister()</code> 只解除注册，不会立刻让当前页面失去控制；
                已打开的页面会继续由旧 SW 控制，直到刷新或关闭。
                清理缓存要按命名空间过滤，因为 Cache Storage 在同一 origin 下是所有应用共享的。
            </p>
            <CodeBlock :code="CLEANUP_CODE" lang="ts" title="注销与按前缀清理缓存" />
            <ul class="checklist">
                <li v-for="item in notes" :key="item">{{ item }}</li>
            </ul>
        </DocSection>

        <DocSection id="update" title="更新与接管" kicker="04 · UPDATE">
            <p class="body-text">
                浏览器会定期检查 sw.js 是否变化。新版本安装完成后不会立即替换旧版本，
                而是停在 <code>waiting</code>：因为此时可能还有页面在使用旧资源。
                让用户决定何时刷新，是避免数据丢失的关键。
            </p>
            <CodeBlock :code="UPDATE_CODE" lang="ts" title="updatefound 与 controllerchange" />
            <Callout type="warn" title="不要自动无限刷新">
                <code>controllerchange</code> 可能触发多次。生产代码要用一个布尔锁
                （如 <code>refreshing</code>）保证 <code>location.reload()</code> 只执行一次。
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

.env-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.env-chip {
    padding: 3px 9px;
    border: 1px solid var(--line);
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
}

.env--ok {
    border-color: var(--success-border);
    background: var(--success-soft);
    color: var(--success);
}

.env--bad {
    border-color: rgba(248, 113, 113, 0.4);
    color: var(--danger);
}

.env--warn {
    border-color: rgba(251, 191, 36, 0.4);
    color: var(--warn);
}

.env--idle {
    color: var(--text-faint);
}

.demo-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 16px 0 0;
}

.hint {
    margin: 12px 0 0;
    font-size: 12px;
    line-height: 1.7;
    color: var(--text-faint);
}

.hint--warn {
    color: var(--warn);
}

.status-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 16px;
}

.status-item {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
}

.status-item--wide {
    grid-column: 1 / -1;
}

.status-label {
    font-size: 11px;
    color: var(--text-faint);
}

.status-value {
    font-size: 13px;
    font-weight: 600;
    overflow-wrap: anywhere;
}

.tone--ok {
    color: var(--accent);
}

.tone--bad {
    color: var(--danger);
}

.tone--idle {
    color: var(--text-muted);
}

.cache-block {
    margin-top: 16px;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
}

.cache-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.cache-title {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-muted);
}

.cache-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 10px 0 0;
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

.message {
    margin: 16px 0 0;
    padding: 10px 12px;
    border-left: 3px solid var(--accent);
    border-radius: 6px;
    background: var(--surface-2);
    font-size: 13px;
    line-height: 1.7;
    color: var(--text-muted);
}

.message--bad {
    border-left-color: var(--danger);
    color: var(--danger);
}

@media (max-width: 560px) {
    .status-grid {
        grid-template-columns: 1fr;
    }
}
</style>

