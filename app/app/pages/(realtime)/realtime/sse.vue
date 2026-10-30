<script setup lang="ts">
definePageMeta({ layout: 'docs' });

type Status = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

interface LogEntry {
    key: number;
    name: string;
    payload: string;
    at: string;
}

const status = ref<Status>('idle');
const logs = ref<LogEntry[]>([]);
const tickCount = ref(0);
const errorCount = ref(0);
const lastEventId = ref('');
const connectedAt = ref('');
const lastTickAt = ref('');
const errorMessage = ref('');

let eventSource: EventSource | null = null;
let logKey = 0;

const statusLabel = computed(() => {
    const labels: Record<Status, string> = {
        idle: '未连接',
        connecting: '连接中',
        open: '已连接',
        reconnecting: '重连中',
        closed: '已关闭',
    };
    return labels[status.value];
});

const statusTone = computed(() => {
    if (status.value === 'open') return 'ok';
    if (status.value === 'closed') return 'bad';
    if (status.value === 'reconnecting') return 'warn';
    return 'idle';
});

const active = computed(() => status.value === 'open' || status.value === 'connecting' || status.value === 'reconnecting');

function now() {
    return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

function pushLog(name: string, payload: string) {
    logs.value = [
        { key: logKey++, name, payload, at: now() },
        ...logs.value,
    ].slice(0, 7);
}

function connect() {
    if (typeof EventSource === 'undefined') {
        status.value = 'closed';
        errorMessage.value = '当前浏览器不支持 EventSource。';
        return;
    }

    close(false);
    errorMessage.value = '';
    status.value = 'connecting';

    const source = new EventSource('/api/realtime/sse');
    eventSource = source;

    source.addEventListener('ready', (event) => {
        const message = event as MessageEvent<string>;
        status.value = 'open';
        try {
            const payload = JSON.parse(message.data) as { connectedAt?: number; intervalMs?: number };
            connectedAt.value = payload.connectedAt
                ? new Date(payload.connectedAt).toLocaleTimeString('zh-CN', { hour12: false })
                : now();
        } catch {
            connectedAt.value = now();
        }
        pushLog('ready', message.data);
    });

    source.addEventListener('tick', (event) => {
        const message = event as MessageEvent<string>;
        tickCount.value += 1;
        lastEventId.value = message.lastEventId || '—';
        lastTickAt.value = now();
        pushLog('tick', message.data);
    });

    source.onerror = () => {
        if (source.readyState === EventSource.CLOSED) {
            status.value = 'closed';
            errorMessage.value = '连接已关闭：服务端返回非 200，或网络不可用。';
            eventSource = null;
            return;
        }
        status.value = 'reconnecting';
        errorCount.value += 1;
    };
}

function close(resetStatus = true) {
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
    if (resetStatus) status.value = 'closed';
}

function clearLogs() {
    logs.value = [];
}

onBeforeUnmount(() => {
    close(false);
});

const PROTOCOL_CODE = `HTTP/1.1 200 OK
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive

retry: 3000

event: ready
data: {"connectedAt":1761744000000,"intervalMs":1500}

id: 1
event: tick
data: {"count":1,"now":1761744001500}

: heartbeat

// 规则
// 1. 每个字段一行，事件之间用空行分隔
// 2. data 可以多行，客户端会自动用换行拼接
// 3. 以冒号开头的行是注释，只用于心跳，不触发事件
// 4. id 用于断线续传，浏览器重连时带 Last-Event-ID 请求头`;

const SERVER_CODE = `export default defineEventHandler(async (event) => {
    const res = event.node.res;
    const req = event.node.req;

    setResponseHeader(event, 'Content-Type', 'text/event-stream; charset=utf-8');
    setResponseHeader(event, 'Cache-Control', 'no-cache, no-transform');
    setResponseHeader(event, 'X-Accel-Buffering', 'no');

    res.statusCode = 200;
    res.flushHeaders?.();

    let closed = false;
    let count = 0;
    let timer;

    const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        res.end();
    };

    res.write('retry: 3000\\n\\n');
    res.write('event: ready\\ndata: ' + JSON.stringify({ intervalMs: 1500 }) + '\\n\\n');

    timer = setInterval(() => {
        count += 1;
        res.write('event: tick\\ndata: ' + JSON.stringify({ count, now: Date.now() }) + '\\n\\n');
    }, 1500);

    res.on('close', cleanup);
    req.on('close', cleanup);

    await new Promise<void>((resolve) => {
        const done = () => { cleanup(); resolve(); };
        res.once('close', done);
        req.once('close', done);
    });
});`;

const CLIENT_CODE = `const source = new EventSource('/api/realtime/sse');

source.addEventListener('ready', (event) => {
    status.value = 'open';
});

source.addEventListener('tick', (event) => {
    const payload = JSON.parse(event.data);
    lastEventId.value = event.lastEventId;
    ticks.value.push(payload);
});

source.onerror = () => {
    // CONNECTING = 浏览器正在自动重连
    status.value = source.readyState === EventSource.CLOSED
        ? 'closed'
        : 'reconnecting';
};

// 组件卸载 / 页面离开必须关闭，否则连接会一直占用
onBeforeUnmount(() => source.close());`;

const readyStateRows = [
    { value: '0 · CONNECTING', meaning: '正在建立连接或等待重连', action: '不要重复 new EventSource' },
    { value: '1 · OPEN', meaning: '连接已建立，可接收事件', action: '正常渲染增量数据' },
    { value: '2 · CLOSED', meaning: '连接已关闭且不会重连', action: '提示用户手动重试' },
];

const protocolNotes = [
    '事件名不要与 EventSource 内置的 open / message / error 冲突；本接口使用 ready 与 tick。',
    '服务端必须保持响应不结束；handler 要挂起到连接关闭，否则 Nitro 会提前收尾。',
    '中间代理可能缓冲响应，只有 X-Accel-Buffering: no 与心跳才能保证「逐条送达」。',
    '客户端重连后可能收到重复数据，业务层应按事件 id 或业务主键去重。',
];
</script>

<template>
    <DocPage
        title="SSE 单向推送"
        description="SSE 用一条普通 HTTP 连接持续下发事件，浏览器内置断线重连。本页连接真实的 /api/realtime/sse 接口，观察事件格式、重连次数与连接状态。"
        :tags="['text/event-stream', 'EventSource', 'retry', 'Last-Event-ID', '心跳']"
    >
        <DocSection id="protocol" title="协议：一行一个字段" kicker="01 · PROTOCOL">
            <p class="body-text">
                SSE 的报文是纯文本：<code>event</code> 指定事件名，<code>data</code> 是负载，
                <code>id</code> 用于断线续传，<code>retry</code> 指定重连间隔。
                事件之间用空行分隔，冒号开头的行是注释，可以用来做心跳。
            </p>
            <CodeBlock :code="PROTOCOL_CODE" lang="http" title="一次完整的 SSE 响应" />
        </DocSection>

        <DocSection id="server" title="服务端：保持连接，且能被关闭" kicker="02 · SERVER">
            <p class="body-text">
                关键在于三点：响应头声明 <code>text/event-stream</code>；
                <code>flushHeaders()</code> 让浏览器立刻进入 open 状态；
                handler 挂起到连接关闭，同时在 <code>close</code> 事件里清理定时器。
                少了任何一步，都会表现为「连接建立了但收不到数据」或「断开后仍在推送」。
            </p>
            <CodeBlock :code="SERVER_CODE" lang="ts" title="server/api/realtime/sse.get.ts" />
            <Callout type="warn" title="清理必须幂等">
                <code>res</code> 与 <code>req</code> 的 close 都可能先触发。
                清理函数要用一个 <code>closed</code> 标志保证只执行一次，
                避免重复 <code>clearInterval</code> 或重复 <code>res.end()</code>。
            </Callout>
        </DocSection>

        <DocSection id="demo" title="EventSource 实验台" kicker="03 · DEMO">
            <p class="body-text">
                点击连接后，服务端每 1.5 秒推送一个 <code>tick</code>。
                断开后 EventSource 会按 <code>retry</code> 自动重连，状态变为「重连中」；
                主动关闭则不会重连。可以打开开发者工具的 Network 观察同一请求一直处于 pending。
            </p>

            <DemoCard
                title="SSE 事件流"
                desc="连接真实接口，观察 ready / tick 事件与重连状态。"
                badge="LIVE"
            >
                <div class="demo-actions">
                    <button type="button" class="btn btn--sm" :disabled="active" @click="connect">
                        连接
                    </button>
                    <button type="button" class="btn btn--ghost btn--sm" :disabled="!active" @click="close()">
                        关闭
                    </button>
                    <button type="button" class="btn btn--ghost btn--sm" @click="clearLogs">
                        清空事件
                    </button>
                </div>

                <div class="status-grid">
                    <div class="status-item">
                        <span class="status-label">连接状态</span>
                        <span class="status-value" :class="`tone--${statusTone}`">{{ statusLabel }}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">tick 次数</span>
                        <span class="status-value mono">{{ tickCount }}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">错误 / 重连</span>
                        <span class="status-value mono">{{ errorCount }}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Last-Event-ID</span>
                        <span class="status-value mono">{{ lastEventId || '—' }}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">连接建立时间</span>
                        <span class="status-value mono">{{ connectedAt || '—' }}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">最近 tick</span>
                        <span class="status-value mono">{{ lastTickAt || '—' }}</span>
                    </div>
                </div>

                <p v-if="errorMessage" class="hint hint--warn">{{ errorMessage }}</p>

                <div class="log-wrap">
                    <div class="log-head">
                        <span class="log-title">最近事件</span>
                        <span class="mono">{{ logs.length }} / 7</span>
                    </div>
                    <ul v-if="logs.length" class="log-list">
                        <li v-for="entry in logs" :key="entry.key" class="log-row">
                            <span class="log-time mono">{{ entry.at }}</span>
                            <span class="badge" :class="entry.name === 'tick' ? 'badge--info' : 'badge--accent'">
                                {{ entry.name }}
                            </span>
                            <span class="log-payload mono">{{ entry.payload }}</span>
                        </li>
                    </ul>
                    <p v-else class="hint">点击「连接」开始接收事件。</p>
                </div>

                <template #footer>
                    <span v-if="status === 'open'">
                        已连接：服务端每 1.5 秒推送一次 tick，页面离开时会自动关闭连接。
                    </span>
                    <span v-else-if="status === 'reconnecting'">
                        浏览器正在自动重连（retry: 3000）。可以点「关闭」停止重连。
                    </span>
                    <span v-else>连接关闭后不会占用服务端资源；再次点击「连接」会新建一条 EventSource。</span>
                </template>
            </DemoCard>
        </DocSection>

        <DocSection id="reliability" title="重连、去重与背压" kicker="04 · RELIABILITY">
            <p class="body-text">
                EventSource 的自动重连只解决「连接恢复」，不解决「数据正确」。
                重连期间可能重复收到同一条事件，业务层要用 <code>id</code> 或业务主键去重；
                慢客户端则需要服务端在 <code>write</code> 返回 false 时暂停推送。
            </p>
            <CodeBlock :code="CLIENT_CODE" lang="ts" title="客户端状态与清理" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>readyState</th><th>含义</th><th>处理方式</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in readyStateRows" :key="row.value">
                            <td class="mono">{{ row.value }}</td>
                            <td>{{ row.meaning }}</td>
                            <td>{{ row.action }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <ul class="checklist">
                <li v-for="item in protocolNotes" :key="item">{{ item }}</li>
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

.status-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-top: 14px;
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

.status-label {
    font-size: 11px;
    color: var(--text-faint);
}

.status-value {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    overflow-wrap: anywhere;
}

.tone--ok {
    color: var(--accent);
}

.tone--warn {
    color: var(--warn);
}

.tone--bad {
    color: var(--danger);
}

.tone--idle {
    color: var(--text-muted);
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

.log-wrap {
    margin-top: 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    overflow: hidden;
}

.log-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 9px 12px;
    border-bottom: 1px solid var(--line);
    background: var(--surface-2);
    font-size: 11px;
    color: var(--text-faint);
}

.log-title {
    font-family: var(--font-mono);
    color: var(--text-muted);
}

.log-list {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
}

.log-row {
    display: grid;
    grid-template-columns: 74px auto minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--line);
    font-size: 11px;
}

.log-row:last-child {
    border-bottom: none;
}

.log-time {
    color: var(--text-faint);
}

.log-payload {
    color: var(--text-muted);
    overflow-wrap: anywhere;
}

@media (max-width: 640px) {
    .status-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .log-row {
        grid-template-columns: 64px auto;
    }

    .log-payload {
        grid-column: 1 / -1;
        padding-left: 0;
    }
}
</style>

