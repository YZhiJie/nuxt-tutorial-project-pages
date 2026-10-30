<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const live = ref('');
const scraping = ref(false);
const error = ref('');

async function scrapeNow() {
    if (scraping.value) return;
    scraping.value = true;
    error.value = '';
    try {
        live.value = await $fetch<string>('/api/observability/metrics');
    } catch {
        error.value = '抓取失败，请确认服务端接口已启用。';
    } finally {
        scraping.value = false;
    }
}

const TYPES = [
    {
        type: 'counter',
        rule: '只增不减',
        use: '请求数、错误数、发送字节',
        example: 'nuxt_http_requests_total',
    },
    {
        type: 'gauge',
        rule: '可增可减',
        use: '并发数、队列长度、连接池占用',
        example: 'nuxt_http_in_flight_requests',
    },
    {
        type: 'histogram',
        rule: '按桶累计 + sum/count',
        use: '耗时、响应体大小',
        example: 'nuxt_http_request_duration_ms_bucket',
    },
    {
        type: 'summary',
        rule: '由 histogram 派生',
        use: 'P50 / P95 / P99 分位数',
        example: 'histogram_quantile(0.95, ...)',
    },
];

const IMPL_CODE = `// server/utils/observability/metrics.ts（节选）
const DURATION_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000];

export function recordHttpRequest(observation: HttpObservation) {
    const { method, route, status, durationMs } = observation;

    // Rate
    incCounter('nuxt_http_requests_total', {
        method, route, status: String(status),
    });

    // Errors：只有 5xx 进入错误预算
    if (status >= 500) {
        incCounter('nuxt_http_errors_total', {
            method, route, status: String(status),
        });
    }

    // Duration：累计桶计数、sum 与 count
    observeHistogram(
        'nuxt_http_request_duration_ms',
        { method, route },
        durationMs,
    );
}`;

const ENDPOINT_CODE = `// server/api/observability/metrics.get.ts
export default defineEventHandler((event) => {
    setResponseHeader(
        event,
        'content-type',
        'text/plain; version=0.0.4; charset=utf-8',
    );
    setResponseHeader(event, 'cache-control', 'no-store');

    return renderPrometheusMetrics();
});`;

const PROMETHEUS_CODE = `# prometheus.yml
scrape_configs:
  - job_name: 'nuxt-knowledge'
    scrape_interval: 15s
    metrics_path: /api/observability/metrics
    static_configs:
      - targets: ['localhost:3000']

# 验证
# curl -i http://localhost:3000/api/observability/metrics`;

const SAMPLE_METRICS = `# HELP nuxt_http_requests_total Nitro 处理的 HTTP 请求总数。
# TYPE nuxt_http_requests_total counter
nuxt_http_requests_total{method="GET",route="/api/observability/echo",status="200"} 7
nuxt_http_requests_total{method="GET",route="/observability/metrics",status="200"} 3

# HELP nuxt_http_errors_total Nitro 返回 5xx 的 HTTP 请求总数。
# TYPE nuxt_http_errors_total counter
nuxt_http_errors_total{method="GET",route="/api/observability/metrics",status="503"} 1

# HELP nuxt_http_in_flight_requests 当前正在处理中的 HTTP 请求数。
# TYPE nuxt_http_in_flight_requests gauge
nuxt_http_in_flight_requests 1

# HELP nuxt_http_request_duration_ms HTTP 请求耗时分布（毫秒）。
# TYPE nuxt_http_request_duration_ms histogram
nuxt_http_request_duration_ms_bucket{method="GET",route="/api/observability/echo",le="5"} 6
nuxt_http_request_duration_ms_bucket{method="GET",route="/api/observability/echo",le="10"} 7
nuxt_http_request_duration_ms_bucket{method="GET",route="/api/observability/echo",le="25"} 7
nuxt_http_request_duration_ms_bucket{method="GET",route="/api/observability/echo",le="+Inf"} 7
nuxt_http_request_duration_ms_sum{method="GET",route="/api/observability/echo"} 11.428
nuxt_http_request_duration_ms_count{method="GET",route="/api/observability/echo"} 7`;

const NOTES = [
    '进程内 Map 只在单实例内有效：多副本部署时每个实例各自计数，Prometheus 会把它们按标签聚合，但需要保证标签一致。',
    '标签基数必须可控。不要把原始 URL、用户 ID、订单号放进 route 标签；用路由模板或分组后的路径。',
    '抓取端点自身也是一次请求，输出的是“截至上一次请求”的快照，别期待看到本次抓取。',
    '直方图桶要符合业务分布：5ms 一档对慢接口够用，对数据库耗时可能太粗；避免全站共用一套桶。',
    '生产建议交给 prom-client 或 OpenTelemetry：支持多实例、持久化、标准中间件与更完整的类型。',
];
</script>

<template>
    <DocPage
        title="Prometheus 指标"
        description="指标是低成本的聚合信号。本页用内存计数器实现 RED 指标与耗时直方图，并通过 /api/observability/metrics 输出 Prometheus 文本格式，覆盖抓取、命名与基数控制。"
        :tags="['Prometheus', 'RED', 'counter', 'gauge', 'histogram', '标签基数']"
    >
        <DocSection id="types" title="四种指标类型" kicker="01 · TYPES">
            <p class="body-text">
                Prometheus 的指标模型由名称 + 标签 + 数值组成。类型不是装饰，
                它决定了查询语义与聚合方式：counter 用 <code>rate()</code>，
                gauge 直接取值，histogram 才能算分位数。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>类型</th><th>数值规则</th><th>典型用途</th><th>示例名称</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in TYPES" :key="row.type">
                            <td class="mono type-name">{{ row.type }}</td>
                            <td>{{ row.rule }}</td>
                            <td>{{ row.use }}</td>
                            <td class="mono">{{ row.example }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <Callout type="info" title="平均值会骗人">
                延迟要看 P95 / P99。平均值会被大量快请求拉低，
                少数极慢用户的问题会被完全掩盖。
            </Callout>
        </DocSection>

        <DocSection id="implementation" title="内存实现：请求数、错误数、耗时桶与 gauge" kicker="02 · IMPLEMENTATION">
            <p class="body-text">
                工具放在 <code>server/utils/observability/metrics.ts</code>，
                Nitro 会自动导入到同目录树下的中间件与接口，页面不需要直接引用。
                每次请求结束时同时写入三类指标，并用 gauge 跟踪并发数。
            </p>
            <CodeBlock :code="IMPL_CODE" lang="ts" title="recordHttpRequest：一次写入三类指标" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>指标</th><th>类型</th><th>标签</th><th>用途</th></tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="mono">nuxt_http_requests_total</td>
                            <td class="mono">counter</td>
                            <td class="mono">method, route, status</td>
                            <td>rate / 错误率分母</td>
                        </tr>
                        <tr>
                            <td class="mono">nuxt_http_errors_total</td>
                            <td class="mono">counter</td>
                            <td class="mono">method, route, status</td>
                            <td>5xx 错误预算</td>
                        </tr>
                        <tr>
                            <td class="mono">nuxt_http_request_duration_ms</td>
                            <td class="mono">histogram</td>
                            <td class="mono">method, route, le</td>
                            <td>P95 / P99 延迟</td>
                        </tr>
                        <tr>
                            <td class="mono">nuxt_http_in_flight_requests</td>
                            <td class="mono">gauge</td>
                            <td class="mono">—</td>
                            <td>并发与过载判断</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="scrape" title="抓取、输出与验证" kicker="03 · SCRAPE">
            <p class="body-text">
                抓取端点必须返回 <code>text/plain; version=0.0.4</code>，
                并包含 <code># HELP</code> 与 <code># TYPE</code> 行。
                Prometheus 按 <code>scrape_interval</code> 周期拉取，不做推送。
            </p>
            <CodeBlock :code="ENDPOINT_CODE" lang="ts" title="server/api/observability/metrics.get.ts" />
            <CodeBlock :code="PROMETHEUS_CODE" lang="yaml" title="Prometheus 抓取配置" />

            <DemoCard title="抓取一次指标" desc="直接请求 /api/observability/metrics，返回当前进程内的指标快照。" badge="LIVE">
                <div class="demo-actions">
                    <button class="btn btn--sm" type="button" :disabled="scraping" @click="scrapeNow">
                        {{ scraping ? '抓取中…' : '抓取一次' }}
                    </button>
                    <a href="/api/observability/metrics" target="_blank" rel="noopener" class="api-link mono">
                        在新窗口打开 →
                    </a>
                </div>
                <p v-if="error" class="scrape-error">{{ error }}</p>
                <pre v-if="live" class="scrape-out">{{ live }}</pre>
                <p v-else class="scrape-empty">尚未抓取。每次点击都会看到计数增长。</p>
                <template #footer>
                    输出为纯文本，方便直接粘贴到 Prometheus 的抓取调试页或终端。
                </template>
            </DemoCard>

            <CodeBlock :code="SAMPLE_METRICS" lang="text" title="示例输出（节选）" />
        </DocSection>

        <DocSection id="production" title="生产环境注意" kicker="04 · PRODUCTION">
            <ul class="checklist">
                <li v-for="item in NOTES" :key="item">{{ item }}</li>
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

.type-name {
    color: var(--accent);
    font-weight: 600;
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

.scrape-out {
    max-height: 320px;
    margin: 14px 0 0;
    overflow: auto;
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
    font-size: 12px;
    line-height: 1.7;
    white-space: pre;
}

.scrape-empty {
    margin: 14px 0 0;
    font-size: 12px;
    color: var(--text-faint);
}

.scrape-error {
    margin: 14px 0 0;
    font-size: 12px;
    color: var(--danger);
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
