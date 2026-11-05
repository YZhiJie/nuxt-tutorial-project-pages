<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const WS_SERVER_CODE = `// server/ws/index.ts —— 独立进程，不要塞进无状态函数
// 依赖 ws（本项目未安装，示例只展示结构）
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 3001 });

wss.on('connection', (socket, request) => {
    const user = authenticate(request);   // 握手阶段鉴权
    if (!user) {
        socket.close(4401, 'unauthorized');
        return;
    }

    const url = new URL(request.url ?? '', 'http://localhost');
    const room = url.searchParams.get('room') ?? 'lobby';
    joinRoom(room, socket);

    socket.on('message', (raw) => broadcast(room, raw));
    socket.on('close', () => leaveRoom(room, socket));
});

// Nitro 只负责签发票据、查询在线状态，不持有长连接`;

const ROOM_CODE = `// 房间：Map<roomId, Set<WebSocket>>
const rooms = new Map<string, Set<WebSocket>>();

function joinRoom(roomId: string, socket: WebSocket) {
    const members = rooms.get(roomId) ?? new Set<WebSocket>();
    members.add(socket);
    rooms.set(roomId, members);
}

function broadcast(roomId: string, payload: string) {
    const members = rooms.get(roomId);
    if (!members) return;

    for (const socket of members) {
        // 关闭中的连接直接 send 会抛错
        if (socket.readyState === socket.OPEN) socket.send(payload);
    }
}

// 心跳：服务端主动 ping，客户端回 pong
setInterval(() => {
    for (const socket of wss.clients) {
        if (!socket.isAlive) {
            socket.terminate();          // 上一轮没有 pong，判定为死连接
            continue;
        }
        socket.isAlive = false;
        socket.ping();
    }
}, 30_000);`;

const REPLAY_CODE = `// 离线补发：为每个房间维护递增序号与有限窗口
interface RoomState {
    seq: number;
    messages: Array<{ seq: number; data: string; at: number }>;
}

// 客户端重连时带上 lastSeq
socket.send(JSON.stringify({
    type: 'sync',
    room,
    lastSeq: Number(searchParams.get('lastSeq') ?? 0),
}));

// 服务端只回放 lastSeq 之后的消息，并限制条数
const pending = messages.filter((item) => item.seq > lastSeq).slice(-200);
for (const item of pending) {
    socket.send(JSON.stringify(item));
}

// 超出保留窗口时不要假装能补全：返回 reset，让页面重新拉快照`;

const AUTH_CODE = `// 1. 握手阶段鉴权：Cookie / 短期票据 / Origin 校验
const origin = request.headers.origin;
if (!ALLOWED_ORIGINS.has(origin ?? '')) {
    socket.close(4403, 'origin not allowed');
    return;
}

// 2. 不要在 URL 里放长期密钥；用一次性、短时效 ticket
// wss://example.com/ws?ticket=xxx

// 3. 授权是「每个动作」都要做的事，不是连接时做一次
socket.on('message', (raw) => {
    const action = parse(raw);
    if (!can(user, action)) {
        socket.send(JSON.stringify({ type: 'error', code: 403 }));
        return;
    }
});`;

const decisionRows = [
    { scene: '聊天 / IM', pick: 'WebSocket', why: '双向高频，SSE 需要额外写接口' },
    { scene: '协同编辑 / 白板', pick: 'WebSocket', why: '多人同时广播，延迟要求高' },
    { scene: '通知 / 任务进度', pick: 'SSE', why: '单向推送，HTTP 基础设施可复用' },
    { scene: 'AI 流式文本', pick: 'SSE 或 fetch stream', why: '只需服务端下发增量' },
    { scene: '大屏指标（分钟级）', pick: '轮询', why: '频率低，连接成本不划算' },
];

const retentionRows = [
    { topic: '心跳', setting: '30 秒 ping / pong', reason: '代理通常 60 秒回收空闲连接' },
    { topic: '离线补发窗口', setting: '最近 200 条或 5 分钟', reason: '内存可控，超出窗口返回 reset' },
    { topic: '单条消息大小', setting: '≤ 64 KB', reason: '防止单个客户端拖垮广播' },
    { topic: '房间人数', setting: '按业务分层限流', reason: '大房间广播成本是 O(n)' },
];

const notes = [
    '本项目没有安装 ws 依赖；生产接入需要自行添加，并把 WS 进程与 Nitro 分开部署、分别扩缩容。',
    'Serverless / Edge 运行时无法长期持有连接，WebSocket 需要常驻进程或托管服务。',
    '进程内 Map 只对单实例有效；多副本必须用 Redis Pub/Sub 或消息队列广播。',
    '连接建立不等于授权完成：每个消息动作都要再次校验用户与房间的归属关系。',
    '协议要带版本号，客户端与旧服务端不匹配时明确拒绝，避免静默错乱。',
    '断线不等于下线：用最后活跃时间判定在线状态，不要只依赖 close 事件。',
];
</script>

<template>
    <DocPage
        title="WebSocket 房间"
        description="WebSocket 的价值是双向与低延迟，代价是长连接管理。本页讲解独立 WS 进程、房间广播、心跳、离线补发与逐动作鉴权；本项目未安装 ws 依赖，示例只展示结构。"
        :tags="['双向通信', '独立进程', '房间广播', '心跳', '离线补发']"
    >
        <DocSection id="when" title="什么时候真的需要双向" kicker="01 · WHEN">
            <p class="body-text">
                WebSocket 适合「客户端与服务端都要频繁说话」的场景。
                如果只是服务端单向推送，SSE 更简单：它复用 HTTP 鉴权、代理与日志，
                而 WebSocket 需要自己处理连接生命周期、心跳与广播。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>场景</th><th>推荐</th><th>原因</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in decisionRows" :key="row.scene">
                            <td>{{ row.scene }}</td>
                            <td>{{ row.pick }}</td>
                            <td>{{ row.why }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <Callout type="warn" title="没有安装 ws 依赖">
                本项目只演示协议与结构，不包含 <code>ws</code> 运行时。
                生产接入需要新增依赖、独立部署常驻进程，并补充连接数与内存监控。
            </Callout>
        </DocSection>

        <DocSection id="process" title="独立进程与 Nitro 集成" kicker="02 · PROCESS">
            <p class="body-text">
                Nitro 的 HTTP 处理是无状态的：每个请求进来、返回、结束。
                WebSocket 连接要跨越很长时间，因此通常拆成独立进程，
                由 Nitro 负责签发短期票据，WS 进程负责握手、房间与广播。
                两者的扩缩容策略不同，混在一起会让「加机器」变成「连接错乱」。
            </p>
            <CodeBlock :code="WS_SERVER_CODE" lang="ts" title="独立 WS 服务（示意）" />
        </DocSection>

        <DocSection id="room" title="房间、心跳与离线补发" kicker="03 · ROOM">
            <p class="body-text">
                房间是最小广播单元。数据结构通常是一个
                <code>Map&lt;roomId, Set&lt;socket&gt;&gt;</code>；
                心跳负责发现死连接；离线补发负责让重连的客户端拿到错过的事件。
                三者都必须有上限，否则内存会被慢慢吃光。
            </p>
            <CodeBlock :code="ROOM_CODE" lang="ts" title="房间广播与心跳" />
            <CodeBlock :code="REPLAY_CODE" lang="ts" title="按序号补发与 reset" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>项目</th><th>建议值</th><th>理由</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in retentionRows" :key="row.topic">
                            <td>{{ row.topic }}</td>
                            <td class="mono">{{ row.setting }}</td>
                            <td>{{ row.reason }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="auth" title="鉴权与运维边界" kicker="04 · AUTH">
            <p class="body-text">
                WebSocket 的鉴权分两层：握手时确认「你是谁」，消息时确认「你能做什么」。
                只做前者，等于把房间内所有操作都交给了连接本身；
                只做后者，则每次消息都要重新验证身份，成本更高。
            </p>
            <CodeBlock :code="AUTH_CODE" lang="ts" title="Origin / 票据 / 逐动作授权" />
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
</style>
