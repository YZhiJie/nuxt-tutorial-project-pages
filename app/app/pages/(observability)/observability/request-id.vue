<script setup lang="ts">
definePageMeta({ layout: 'docs' });

interface EchoPayload {
    requestId: string;
    now: string;
    duration: number;
}

const responseHeaderId = useState<string>('observability-echo-header', () => '—');

const { data, refresh, pending } = useFetch<EchoPayload>(
    '/api/observability/echo',
    {
        key: 'observability-echo',
        onResponse({ response }) {
            responseHeaderId.value = response.headers.get('x-request-id') ?? '—';
        },
    },
);

const refreshing = ref(false);
const history = ref<EchoPayload[]>([]);

watch(
    data,
    (value) => {
        if (!value) return;
        if (history.value[0]?.requestId === value.requestId) return;
        history.value = [value, ...history.value].slice(0, 5);
    },
    { immediate: true },
);

async function reload() {
    if (refreshing.value) return;
    refreshing.value = true;
    try {
        await refresh();
    } finally {
        refreshing.value = false;
    }
}

const MIDDLEWARE_CODE = `import { randomUUID } from 'node:crypto';

// server/middleware/observability.ts
export default defineEventHandler((event) => {
    const requestId = randomUUID();
    const startedAt = performance.now();
    const method = event.node.req.method ?? 'GET';
    const path = getRequestURL(event).pathname;

    // 1) 写入请求上下文，后续处理器可直接读取
    event.context.requestId = requestId;
    event.context.requestStartedAt = startedAt;

    // 2) 回写响应头，调用方 / 网关可记录同一条 ID
    setResponseHeader(event, 'x-request-id', requestId);

    // 3) 响应结束时统一记录状态码与耗时
    event.node.res.on('finish', () => {
        const status = event.node.res.statusCode;
        const durationMs = performance.now() - startedAt;

        console.log(JSON.stringify({
            level: status >= 500 ? 'error' : 'info',
            msg: 'http_request',
            requestId, method, path, status,
            durationMs: Number(durationMs.toFixed(2)),
        }));
    });
});`;

const ECHO_CODE = `// server/api/observability/echo.get.ts
interface ObservabilityContext {
    requestId?: string;
    requestStartedAt?: number;
}

export default defineEventHandler((event) => {
    setResponseHeader(event, 'cache-control', 'no-store');

    const context = event.context as ObservabilityContext;
    const startedAt = context.requestStartedAt ?? performance.now();

    return {
        requestId: context.requestId ?? 'unknown',
        now: new Date().toISOString(),
        duration: Number((performance.now() - startedAt).toFixed(2)),
    };
});`;

const LOG_LINE = `{
  "level": "info",
  "msg": "http_request",
  "requestId": "6f1c0f5e-8a7d-4f43-9f31-0f0f9f7f5d63",
  "method": "GET",
  "path": "/api/observability/echo",
  "status": 200,
  "durationMs": 1.42
}`;

const PROPAGATION_CODE = `// 1) 页面向下游接口透传同一个 requestId
await $fetch('/api/inventory', {
    headers: { 'x-request-id': requestId },
});

// 2) 下游服务读取；没有就自己生成一个，保证链路不断
const incoming = getRequestHeader(event, 'x-request-id');
const requestId = incoming ?? crypto.randomUUID();

// 3) 同一请求内的深层函数不想层层传参时，
//    用 AsyncLocalStorage 保存上下文（Nitro 可用 node:async_hooks）
import { AsyncLocalStorage } from 'node:async_hooks';
export const requestContext = new AsyncLocalStorage<{ requestId: string }>();

// 中间件里执行：requestContext.run({ requestId }, () => next())`;

const PITFALLS = [
    'requestId 只在 event.context 里有效，异步任务、定时器与队列消费不会自动携带，需要显式传参。',
    '不要用自增数字或时间戳做 requestId：多实例下会撞号，也无法可靠排序。',
    '日志只打印 requestId 而不打印业务键（用户、订单、路由），排查时仍然只能靠猜。',
    '中间件顺序会影响覆盖范围：前面的中间件抛错时，后面的观测中间件不会执行。',
    '响应头已经发送后再写 x-request-id 会报错，必须在请求早期设置。',
];
</script>

<template>
    <DocPage
        title="请求上下文与日志"
        description="一次请求从进入 Nitro 到离开，会穿过中间件、接口、缓存与下游服务。requestId 是贯穿整条链路的唯一线索：写进上下文、响应头与每一行日志，才能把碎片拼成完整故事。"
        :tags="['requestId', 'event.context', 'x-request-id', '结构化日志', '链路传播']"
    >
        <DocSection id="demo" title="每次请求都是新的 ID" kicker="01 · CONTEXT">
            <p class="body-text">
                接口 <code>/api/observability/echo</code> 直接返回中间件写入
                <code>event.context</code> 的 requestId。点击刷新会发起新请求，
                ID、时间与耗时都会变化；响应头 <code>x-request-id</code> 与响应体保持一致。
            </p>
            <DemoCard
                title="requestId 回显"
                desc="数据来自 /api/observability/echo；响应头 x-request-id 与响应体 requestId 相同。"
                badge="LIVE"
            >
                <dl class="stat-grid">
                    <div class="stat">
                        <dt>response.body.requestId</dt>
                        <dd class="mono">{{ data?.requestId ?? '加载中…' }}</dd>
                    </div>
                    <div class="stat">
                        <dt>响应头 x-request-id（与 body 一致）</dt>
                        <dd class="mono">{{ responseHeaderId }}</dd>
                    </div>
                    <div class="stat">
                        <dt>server now</dt>
                        <dd class="mono">{{ data?.now ?? '—' }}</dd>
                    </div>
                    <div class="stat">
                        <dt>duration（中间件 → 接口）</dt>
                        <dd class="mono">{{ data?.duration ?? '—' }} ms</dd>
                    </div>
                </dl>

                <div v-if="history.length" class="history">
                    <p class="history-title">最近 {{ history.length }} 次请求</p>
                    <div v-for="entry in history" :key="entry.requestId" class="history-row">
                        <span class="mono history-id">{{ entry.requestId.slice(0, 8) }}…</span>
                        <span class="mono history-time">{{ entry.now }}</span>
                        <span class="mono history-duration">{{ entry.duration }}ms</span>
                    </div>
                </div>

                <template #footer>
                    <div class="demo-actions">
                        <button class="btn btn--sm" type="button" :disabled="refreshing || pending" @click="reload">
                            {{ refreshing || pending ? '请求中…' : '重新请求' }}
                        </button>
                        <a href="/api/observability/echo" target="_blank" rel="noopener" class="api-link mono">
                            直接打开接口 →
                        </a>
                    </div>
                </template>
            </DemoCard>
        </DocSection>

        <DocSection id="middleware" title="中间件写入上下文与响应头" kicker="02 · MIDDLEWARE">
            <p class="body-text">
                中间件是唯一能在请求最早期统一处理的地方。它做三件事：
                生成 ID 并写入 <code>event.context</code>、回写 <code>x-request-id</code>、
                在响应结束时记录状态码与耗时。注意它<strong>不改变请求结果</strong>，
                也不重复抛出错误，避免与已有的 <code>logger.ts</code> 冲突。
            </p>
            <CodeBlock :code="MIDDLEWARE_CODE" lang="ts" title="server/middleware/observability.ts" />
            <CodeBlock :code="ECHO_CODE" lang="ts" title="server/api/observability/echo.get.ts" />
            <Callout type="warn" title="中间件顺序决定覆盖范围">
                Nitro 按文件名顺序执行中间件。如果鉴权中间件先抛出 401，
                排在后面的观测中间件就不会执行，这次请求也就没有 requestId。
                需要覆盖失败请求时，可以把观测中间件命名为更靠前的文件，
                或者在错误处理链路里补写 ID。
            </Callout>
        </DocSection>

        <DocSection id="logging" title="结构化日志的最小字段集" kicker="03 · LOGGING">
            <p class="body-text">
                日志要能被机器检索，而不是只给人看。推荐统一输出 JSON，每行一个事件，
                至少包含 <code>level</code>、<code>msg</code>、<code>requestId</code> 与
                <code>durationMs</code>；业务事件再增加订单号、用户与结果码。
            </p>
            <CodeBlock :code="LOG_LINE" lang="json" title="一行结构化访问日志" />
            <p class="body-text">
                同一条 ID 还要继续向上下游传播。只在本服务内生成、不传给下游，
                链路会在第一次跨服务调用处断开。
            </p>
            <CodeBlock :code="PROPAGATION_CODE" lang="ts" title="把 requestId 传下去" />
        </DocSection>

        <DocSection id="pitfalls" title="实践中的坑" kicker="04 · PITFALLS">
            <ul class="checklist">
                <li v-for="item in PITFALLS" :key="item">{{ item }}</li>
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

.body-text strong {
    color: var(--text);
    font-weight: 600;
}

.stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    gap: 12px;
    margin: 0;
}

.stat {
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
}

.stat dt {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-faint);
    word-break: break-all;
}

.stat dd {
    margin: 6px 0 0;
    font-size: 14px;
    color: var(--accent);
    word-break: break-all;
}

.history {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
}

.history-title {
    margin: 0 0 4px;
    font-size: 11px;
    color: var(--text-faint);
}

.history-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    font-size: 12px;
}

.history-id {
    color: var(--accent);
}

.history-time {
    color: var(--text-muted);
    word-break: break-all;
}

.history-duration {
    margin-left: auto;
    color: var(--text-faint);
}

.demo-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
}

.api-link {
    font-size: 12px;
    color: var(--accent);
    border-bottom: 1px dashed var(--accent);
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
    padding-left: 26px;
    font-size: 14px;
    line-height: 1.7;
    color: var(--text-muted);
}

.checklist li::before {
    content: '!';
    position: absolute;
    left: 0;
    top: 0;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: rgba(251, 191, 36, 0.15);
    color: var(--warn);
    font-family: var(--font-mono);
    font-size: 11px;
}
</style>
