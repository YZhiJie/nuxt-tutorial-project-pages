<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const SELECT_CODE = `// 轮询：实现最简单，但延迟与请求量随频率线性增长
// 适合「分钟级」更新，例如任务状态、报表刷新
setInterval(() => refresh(), 30_000);

// SSE：服务端 → 客户端单向推送，基于 HTTP
// 浏览器内置断线重连；适合通知、日志、进度、AI 流式文本
const source = new EventSource('/api/realtime/sse');

// WebSocket：双向、低延迟；需要独立进程或 Nitro 的升级支持
// 适合聊天、协同编辑、游戏、多人状态同步
const ws = new WebSocket('wss://example.com/ws');`;

const RECONNECT_CODE = `// 服务端：用 retry 指定重连间隔，用 id 支持断点续传
res.write('retry: 3000\\n\\n');
res.write('id: ' + seq + '\\ndata: ' + JSON.stringify(payload) + '\\n\\n');

// 客户端：区分「连接中」「已断开」「主动关闭」
source.onopen = () => {
    status.value = 'open';
    attempts.value = 0;
};

source.onerror = () => {
    if (source.readyState === EventSource.CLOSED) {
        status.value = 'closed';        // 服务端返回 204 或彻底失败
        return;
    }
    // CONNECTING：浏览器正在按 retry 自动重连
    status.value = 'reconnecting';
    attempts.value += 1;
};

// 主动关闭后不要再重连
function close() {
    source.close();
    status.value = 'closed';
}`;

const BACKPRESSURE_CODE = `// 服务端：write 返回 false 说明内核缓冲区已满
if (!res.write(chunk)) {
    await new Promise<void>((resolve) => {
        const done = () => {
            res.off('drain', done);
            res.off('close', done);
            resolve();
        };
        res.once('drain', done);
        res.once('close', done);
    });
}

// 客户端：读得慢时，流会被限速
// 不要在渲染循环里做重计算，否则会反过来阻塞网络读取

// 心跳：每 15–30 秒发一条注释行，防止代理回收空闲连接
res.write(': ping\\n\\n');`;

const CLEANUP_CODE = `let timer = setInterval(push, 1500);
let closed = false;

const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    res.end();
};

res.on('close', cleanup);
req.on('close', cleanup); // 双保险

// 漏掉 clearInterval 的后果：
// 客户端断开后定时器仍在跑，每次 write 抛错并持续占用 CPU / 内存`;

const compareRows = [
    { name: '短轮询', direction: '客户端 → 服务端', latency: '等于轮询间隔', cost: '请求数高、多数是空响应', infra: '无特殊要求', fit: '任务状态、低频报表' },
    { name: '长轮询', direction: '客户端 → 服务端（挂起）', latency: '秒级', cost: '服务端需持有大量挂起连接', infra: '注意超时与连接上限', fit: '兼容性要求高的通知' },
    { name: 'SSE', direction: '服务端 → 客户端', latency: '实时', cost: '每个客户端一条 HTTP 连接', infra: '关闭代理缓冲、保持连接', fit: '日志、通知、进度、AI 流式' },
    { name: 'WebSocket', direction: '双向', latency: '实时', cost: '需要连接管理、心跳与房间状态', infra: '独立进程或升级支持', fit: '聊天、协同编辑、多人状态' },
];

const decisionRows = [
    { question: '只需要服务端主动推送？', answer: '用 SSE，不需要引入 WebSocket', why: 'SSE 是普通 HTTP 响应，鉴权、代理、日志都能复用' },
    { question: '客户端也要频繁发消息？', answer: '用 WebSocket', why: '双向通信下 SSE 需要另开写接口，反而更复杂' },
    { question: '更新频率低于 1 次 / 分钟？', answer: '用轮询', why: '实现与运维成本最低，实时性也足够' },
    { question: '部署在会缓冲响应的网关后？', answer: 'SSE 必须关闭缓冲', why: 'X-Accel-Buffering: no，并发送心跳保持连接' },
    { question: '多实例部署需要广播？', answer: '引入 Redis Pub/Sub 或消息队列', why: '单实例内存中的订阅列表无法跨进程共享' },
];

const notes = [
    'SSE 事件名不要用 open / message / error：EventSource 对这几个名字有原生语义，容易与协议事件混淆。',
    '代理层通常有 60 秒空闲超时，必须用注释心跳或定时事件保活。',
    '断线重连是浏览器行为，但业务要去重：重连后可能收到重复事件，客户端应记录最后一条 id。',
    '连接建立后要立即鉴权；SSE 无法设置自定义请求头，凭证通常走 Cookie 或短期查询参数。',
    '每个连接都占用文件描述符与内存，需要限制单用户并发连接数并监控连接总数。',
];
</script>

<template>
    <DocPage
        title="实时通信"
        description="实时不是「一定要 WebSocket」。本模块按通信方向、延迟要求与运维成本对照轮询、SSE 与 WebSocket，并给出断线重连与资源清理的工程做法。"
        :tags="['SSE', 'WebSocket', '轮询', '断线重连', '背压']"
    >
        <DocSection id="compare" title="四种方案的方向与成本" kicker="01 · COMPARE">
            <p class="body-text">
                选择实时方案，先看<strong>谁是发起方</strong>，再看<strong>更新频率</strong>。
                如果只有服务端在推，SSE 就够用；只有客户端偶尔问一次，轮询更省事。
                WebSocket 的价值在于双向，而不是「看起来更实时」。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>方案</th><th>方向</th><th>延迟</th><th>成本</th><th>基础设施</th><th>适用</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in compareRows" :key="row.name">
                            <td>{{ row.name }}</td>
                            <td>{{ row.direction }}</td>
                            <td>{{ row.latency }}</td>
                            <td>{{ row.cost }}</td>
                            <td>{{ row.infra }}</td>
                            <td>{{ row.fit }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="SELECT_CODE" lang="ts" title="三种客户端接入方式" />
        </DocSection>

        <DocSection id="decision" title="选型判断" kicker="02 · DECISION">
            <p class="body-text">
                下面五个问题可以作为选型清单。多数场景在第 1、3 条就能得出结论；
                一旦涉及多实例广播，问题会从「选协议」变成「选消息中间件」。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>问题</th><th>结论</th><th>原因</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in decisionRows" :key="row.question">
                            <td>{{ row.question }}</td>
                            <td>{{ row.answer }}</td>
                            <td>{{ row.why }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <Callout type="info" title="SSE 是 HTTP，不是「残缺的 WebSocket」">
                SSE 复用了鉴权、Cookie、代理、访问日志与限流。对单向推送来说，
                这些成熟能力比「双向」更有价值。
            </Callout>
        </DocSection>

        <DocSection id="reconnect" title="重连、心跳与背压" kicker="03 · RELIABILITY">
            <p class="body-text">
                实时链路一定会断：网络切换、休眠唤醒、代理超时、服务端发布。
                可靠性来自三件事：可预期的重连间隔、可感知的连接状态、可停止的服务端资源。
                背压则决定慢客户端会不会把服务端内存拖垮。
            </p>
            <CodeBlock :code="RECONNECT_CODE" lang="ts" title="retry / id 与客户端状态" />
            <CodeBlock :code="BACKPRESSURE_CODE" lang="ts" title="drain 与心跳" />
        </DocSection>

        <DocSection id="ops" title="资源清理与生产清单" kicker="04 · OPS">
            <p class="body-text">
                实时接口最常见的故障不是「推得慢」，而是「没人收还在推」。
                客户端断开时必须清理定时器、订阅与缓冲区，否则一个页面的反复刷新就能拖垮进程。
            </p>
            <CodeBlock :code="CLEANUP_CODE" lang="ts" title="连接关闭时的清理" />
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
