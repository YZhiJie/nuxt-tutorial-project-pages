<script setup lang="ts">
definePageMeta({ layout: 'docs' });

interface ClockPayload {
    now: string;
    requestId: string;
}

const { data, refresh } = useFetch<ClockPayload>('/api/rendering/clock', {
    key: 'rendering-clock',
});

const refreshing = ref(false);

async function reload() {
    refreshing.value = true;
    try {
        await refresh();
    } finally {
        refreshing.value = false;
    }
}

const CLIENT_CODE = `interface ClockPayload {
    now: string;
    requestId: string;
}

const { data, refresh } = useFetch<ClockPayload>(
    '/api/rendering/clock',
    { key: 'rendering-clock' },
);

// refresh() 会重新发起请求：now 与 requestId 都会变化
await refresh();`;

const SERVER_CODE = `export default defineEventHandler((event) => {
    // 明确告诉浏览器与中间缓存：这份响应不可复用
    setResponseHeader(event, 'cache-control', 'no-store');

    return {
        now: new Date().toISOString(),
        requestId: crypto.randomUUID(),
    };
});`;

const CURL_CODE = `curl -i http://localhost:3000/api/rendering/clock

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json

{"now":"2026-10-30T06:20:11.483Z","requestId":"..."}`;

const pitfalls = [
    'SSR 页面里不要直接渲染 new Date()：服务端与客户端的时钟、时区可能不同，导致水合不一致。',
    '实时接口不适合放在布局中：布局被所有页面共享，会把高成本请求放大到全站。',
    'no-store 只阻止缓存，不会减少数据库压力；高频页面应考虑降采样或 SSE。',
    '客户端刷新按钮应处理失败与 loading，避免用户重复点击造成请求风暴。',
];
</script>

<template>
    <DocPage
        title="SSR 实时渲染"
        description="SSR 在每个请求到达时执行页面与数据获取，返回完整的 HTML。本页用服务端时钟与 requestId 证明：每次请求都是新的渲染结果。"
        :tags="['SSR', 'useFetch', 'no-store', 'requestId']"
    >
        <DocSection id="live" title="实时时钟" kicker="01 · LIVE">
            <p class="body-text">
                当前时间与 <code>requestId</code> 都由服务端接口生成。
                点击“重新请求”会触发一次新的网络请求，两个值都会变化。
            </p>
            <DemoCard title="服务端时钟" desc="数据来自 /api/rendering/clock，响应头为 cache-control: no-store。" badge="LIVE">
                <dl class="stat-grid">
                    <div class="stat">
                        <dt>now（ISO 字符串）</dt>
                        <dd class="mono">{{ data?.now ?? '加载中…' }}</dd>
                    </div>
                    <div class="stat">
                        <dt>requestId</dt>
                        <dd class="mono">{{ data?.requestId ?? '—' }}</dd>
                    </div>
                    <div class="stat">
                        <dt>接口地址</dt>
                        <dd class="mono">/api/rendering/clock</dd>
                    </div>
                </dl>
                <template #footer>
                    <div class="demo-actions">
                        <button class="btn btn--sm" :disabled="refreshing" @click="reload">
                            {{ refreshing ? '请求中…' : '重新请求' }}
                        </button>
                        <a href="/api/rendering/clock" target="_blank" rel="noopener" class="api-link mono">
                            直接打开接口 →
                        </a>
                    </div>
                </template>
            </DemoCard>
            <CodeBlock :code="CLIENT_CODE" lang="ts" title="页面侧：useFetch + refresh" />
        </DocSection>

        <DocSection id="request" title="一次请求发生了什么" kicker="02 · REQUEST">
            <p class="body-text">
                Nitro 收到请求后执行页面 setup，页面里的 <code>useFetch</code> 在服务端直接调用接口处理器，
                拿到数据后渲染成 HTML。浏览器收到 HTML 后水合，后续刷新才走真实的 HTTP 请求。
            </p>
            <CodeBlock :code="SERVER_CODE" lang="ts" title="server/api/rendering/clock.get.ts" />
            <Callout type="info" title="requestId 的用途">
                它把一次页面渲染与后端日志串起来。排查“某个用户看到旧时间”时，
                用页面上的 requestId 反查服务端日志，比只看时间戳可靠。
            </Callout>
        </DocSection>

        <DocSection id="no-store" title="为什么必须是 no-store" kicker="03 · CACHE">
            <p class="body-text">
                实时内容一旦被浏览器、CDN 或反向代理缓存，用户看到的就是旧值。
                <code>no-store</code> 比 <code>no-cache</code> 更严格：连本地磁盘都不保存。
            </p>
            <CodeBlock :code="CURL_CODE" lang="text" title="响应头验证" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>响应头</th><th>行为</th><th>适用</th></tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="mono">no-store</td>
                            <td>完全不缓存</td>
                            <td>实时、个性化、含敏感信息</td>
                        </tr>
                        <tr>
                            <td class="mono">no-cache</td>
                            <td>可存但每次必须回源校验</td>
                            <td>需要 ETag 协商的内容</td>
                        </tr>
                        <tr>
                            <td class="mono">public, s-maxage=60</td>
                            <td>共享缓存 60 秒</td>
                            <td>公共目录、排行榜</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="boundary" title="成本与适用边界" kicker="04 · BOUNDARY">
            <p class="body-text">
                SSR 的成本随流量线性增长，因为每次请求都要执行渲染与数据获取。
                只有“必须实时”或“必须个性化”的页面才值得付出这份成本；其余页面应优先考虑缓存。
            </p>
            <ul class="checklist">
                <li v-for="item in pitfalls" :key="item">{{ item }}</li>
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

.stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
}

.stat dd {
    margin: 6px 0 0;
    font-size: 14px;
    color: var(--accent);
    word-break: break-all;
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
