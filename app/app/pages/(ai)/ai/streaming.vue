<script setup lang="ts">
definePageMeta({ layout: 'docs' });

type Status = 'idle' | 'streaming' | 'done' | 'stopped' | 'error';

const prompt = ref('用三句话解释 SSR 与 CSR 的区别，并说明各自适合的场景。');
const output = ref('');
const status = ref<Status>('idle');
const errorMessage = ref('');
const chunks = ref(0);
const elapsed = ref(0);
const firstByte = ref<number | null>(null);

let controller: AbortController | null = null;
let startedAt = 0;

const statusLabel = computed(() => {
    const labels: Record<Status, string> = {
        idle: '等待开始',
        streaming: '生成中',
        done: '已完成',
        stopped: '已停止',
        error: '请求失败',
    };
    return labels[status.value];
});

const statusTone = computed(() => {
    if (status.value === 'done') return 'ok';
    if (status.value === 'error') return 'bad';
    if (status.value === 'streaming') return 'warn';
    return 'idle';
});

const charCount = computed(() => output.value.length);

async function start() {
    if (status.value === 'streaming') return;

    output.value = '';
    chunks.value = 0;
    elapsed.value = 0;
    firstByte.value = null;
    errorMessage.value = '';

    controller = new AbortController();
    startedAt = performance.now();
    status.value = 'streaming';

    try {
        const response = await fetch('/api/ai/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt.value }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(text || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('当前浏览器不支持 ReadableStream');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (firstByte.value === null) {
                firstByte.value = Math.round(performance.now() - startedAt);
            }

            chunks.value += 1;
            buffer += decoder.decode(value, { stream: true });
            output.value = buffer;
            elapsed.value = Math.round(performance.now() - startedAt);
        }

        buffer += decoder.decode();
        output.value = buffer;
        elapsed.value = Math.round(performance.now() - startedAt);
        status.value = 'done';
    } catch (error) {
        const err = error as Error;
        if (err.name === 'AbortError') {
            status.value = 'stopped';
        } else {
            status.value = 'error';
            errorMessage.value = err.message;
        }
    } finally {
        controller = null;
    }
}

function stop() {
    controller?.abort();
}

function reset() {
    if (status.value === 'streaming') return;
    output.value = '';
    chunks.value = 0;
    elapsed.value = 0;
    firstByte.value = null;
    errorMessage.value = '';
    status.value = 'idle';
}

onBeforeUnmount(() => {
    controller?.abort();
});

const SERVER_CODE = `export default defineEventHandler(async (event) => {
    const { prompt } = await readBody(event);
    if (!prompt?.trim()) throw createError({ statusCode: 400, message: '请输入内容' });

    const res = event.node.res;

    setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8');
    setResponseHeader(event, 'Cache-Control', 'no-store, no-transform');
    setResponseHeader(event, 'X-Accel-Buffering', 'no');

    res.statusCode = 200;
    res.flushHeaders?.();

    let closed = false;
    res.on('close', () => { closed = true; });

    const text = buildReply(prompt);

    for (let i = 0; i < text.length; i += 2) {
        if (closed) break;

        if (!res.write(text.slice(i, i + 2))) {
            // 缓冲区满：等待 drain 或连接关闭
            await waitForDrain(res);
        }

        await delay(35);
    }

    if (!closed) res.end();
});`;

const CLIENT_CODE = `const controller = new AbortController();
const response = await fetch('/api/ai/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
    signal: controller.signal,
});

const reader = response.body?.getReader();
if (!reader) throw new Error('不支持 ReadableStream');

const decoder = new TextDecoder();
let text = '';

while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // stream: true 保证跨块的多字节字符不被截断
    text += decoder.decode(value, { stream: true });
    output.value = text;
}

text += decoder.decode();
output.value = text;

// 用户点停止 / 组件卸载
controller.abort();`;

const failureRows = [
    { case: '用户点击停止', mechanism: 'AbortController.abort()', serverSide: '触发 res close，循环 break', result: '停止生成，不再消耗 token' },
    { case: '客户端读得慢', mechanism: 'res.write 返回 false', serverSide: '等待 drain 事件再继续', result: '内存不会被无限制堆积' },
    { case: '网关缓冲响应', mechanism: 'X-Accel-Buffering: no', serverSide: '同时分段 flush', result: '浏览器能尽早收到首块' },
    { case: '上游超时', mechanism: 'AbortSignal.timeout / 定时器', serverSide: '终止上游请求并返回错误', result: '避免连接一直悬挂' },
    { case: '页面离开', mechanism: 'onBeforeUnmount', serverSide: '连接关闭后清理', result: '不留下孤儿连接' },
];

const notes = [
    '不要用 $fetch 处理流式文本：它默认会读完响应体再解析，失去逐块渲染的意义。',
    'TextDecoder 必须使用 { stream: true }，否则中文跨块时会出现乱码。',
    '每块都直接写 DOM 会触发高频渲染；文本长时可用 requestAnimationFrame 合并更新。',
    '流结束后一定要 res.end()，否则浏览器会一直等待，表现为「生成完了但没结束」。',
    '把首字节延迟与总耗时记录下来，它们是判断上游健康度的两个最直接指标。',
];
</script>

<template>
    <DocPage
        title="流式对话"
        description="流式响应的本质是「边生成边传输」。本页调用真实的 /api/ai/stream 接口，用 fetch + ReadableStream 逐块渲染，并演示停止、首字节延迟与背压。"
        :tags="['ReadableStream', 'text/plain', 'AbortController', '背压', '首字节']"
    >
        <DocSection id="server" title="服务端：分块写入，随时可停" kicker="01 · SERVER">
            <p class="body-text">
                服务端不做 JSON 包装，直接把纯文本按小块写入响应。
                三个细节决定体验：<code>flushHeaders()</code> 让首块尽快到达；
                <code>res.write()</code> 返回 false 时等待 <code>drain</code>；
                <code>close</code> 事件触发后立即停止循环。
            </p>
            <CodeBlock :code="SERVER_CODE" lang="ts" title="server/api/ai/stream.post.ts" />
            <Callout type="warn" title="停止一定要贯穿到上游">
                客户端 abort 只会关闭连接。若服务端仍在等待上游模型生成，
                token 依旧会计费。真实接入时要把同一个 signal 传给上游请求。
            </Callout>
        </DocSection>

        <DocSection id="client" title="客户端：逐块读取与解码" kicker="02 · CLIENT">
            <p class="body-text">
                <code>fetch</code> 返回的 <code>body</code> 是一个
                <code>ReadableStream</code>。用 <code>getReader()</code> 循环读取，
                再用 <code>TextDecoder</code> 解码。注意必须传
                <code>{ stream: true }</code>，否则跨块的中文字符会被截断成乱码。
            </p>
            <CodeBlock :code="CLIENT_CODE" lang="ts" title="读流与中断" />
        </DocSection>

        <DocSection id="demo" title="逐字渲染实验台" kicker="03 · DEMO">
            <p class="body-text">
                下面的提示词会发给本项目的 Nitro 接口，服务端每 35 毫秒写入 2 个字符。
                观察「首字节延迟」与「总耗时」的差异，以及点击停止后字符数停止增长的瞬间。
            </p>

            <DemoCard
                title="流式文本实验台"
                desc="真实调用 /api/ai/stream，支持中途停止。"
                badge="LIVE"
            >
                <label class="field">
                    <span class="field-label">提示词</span>
                    <textarea
                        v-model="prompt"
                        class="prompt-input"
                        rows="3"
                        :disabled="status === 'streaming'"
                    />
                </label>

                <div class="demo-actions">
                    <button
                        type="button"
                        class="btn btn--sm"
                        :disabled="status === 'streaming' || !prompt.trim()"
                        @click="start"
                    >
                        {{ status === 'streaming' ? '生成中……' : '开始生成' }}
                    </button>
                    <button
                        type="button"
                        class="btn btn--ghost btn--sm"
                        :disabled="status !== 'streaming'"
                        @click="stop"
                    >
                        停止
                    </button>
                    <button
                        type="button"
                        class="btn btn--ghost btn--sm"
                        :disabled="status === 'streaming'"
                        @click="reset"
                    >
                        清空
                    </button>
                </div>

                <div class="status-grid">
                    <div class="status-item">
                        <span class="status-label">状态</span>
                        <span class="status-value" :class="`tone--${statusTone}`">{{ statusLabel }}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">字符数</span>
                        <span class="status-value mono">{{ charCount }}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">数据块</span>
                        <span class="status-value mono">{{ chunks }}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">首字节</span>
                        <span class="status-value mono">{{ firstByte === null ? '—' : firstByte + ' ms' }}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">总耗时</span>
                        <span class="status-value mono">{{ elapsed ? elapsed + ' ms' : '—' }}</span>
                    </div>
                </div>

                <p v-if="errorMessage" class="hint hint--warn">{{ errorMessage }}</p>

                <div class="output-box">
                    <div class="output-head">
                        <span class="mono">text/plain</span>
                        <span class="mono">{{ chunks }} chunks</span>
                    </div>
                    <pre v-if="output" class="output-text">{{ output }}<span v-if="status === 'streaming'" class="caret" /></pre>
                    <p v-else class="hint">点击「开始生成」，文本会逐块出现。</p>
                </div>

                <template #footer>
                    <span v-if="status === 'streaming'">
                        正在接收数据：客户端中止会关闭连接，服务端随之停止写入。
                    </span>
                    <span v-else-if="status === 'done'">
                        流已正常结束。首字节延迟与总耗时可用于判断上游健康度。
                    </span>
                    <span v-else>停止后已收到的文本会保留，可以继续编辑提示词再试一次。</span>
                </template>
            </DemoCard>
        </DocSection>

        <DocSection id="failure" title="失败模式与治理" kicker="04 · FAILURE">
            <p class="body-text">
                流式接口的问题往往不是「报错」，而是「一直不结束」。
                下面五种情况覆盖了绝大多数线上故障，排查时按顺序检查即可。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>场景</th><th>客户端机制</th><th>服务端动作</th><th>结果</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in failureRows" :key="row.case">
                            <td>{{ row.case }}</td>
                            <td class="mono">{{ row.mechanism }}</td>
                            <td>{{ row.serverSide }}</td>
                            <td>{{ row.result }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
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

.field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.field-label {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-faint);
}

.prompt-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    color: var(--text);
    font-size: 13px;
    line-height: 1.7;
    resize: vertical;
}

.prompt-input:focus {
    outline: none;
    border-color: var(--accent);
}

.prompt-input:disabled {
    opacity: 0.65;
    cursor: not-allowed;
}

.demo-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
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

.output-box {
    margin-top: 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
    overflow: hidden;
}

.output-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 12px;
    border-bottom: 1px solid var(--line);
    background: var(--surface-2);
    font-size: 11px;
    color: var(--text-faint);
}

.output-text {
    margin: 0;
    padding: 14px 16px;
    min-height: 96px;
    max-height: 320px;
    overflow: auto;
    font-size: 13px;
    line-height: 1.8;
    color: var(--text);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.caret {
    display: inline-block;
    width: 6px;
    height: 14px;
    margin-left: 2px;
    vertical-align: text-bottom;
    background: var(--accent);
    animation: blink 1s steps(2, start) infinite;
}

@keyframes blink {
    to {
        opacity: 0;
    }
}

@media (max-width: 640px) {
    .status-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}
</style>

