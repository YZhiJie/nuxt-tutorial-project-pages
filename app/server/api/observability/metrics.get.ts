/**
 * Prometheus 抓取端点：输出 text/plain; version=0.0.4。
 * 注意本次抓取请求本身会在响应结束后才计入指标，输出的是“截至上一次请求”的快照。
 */
export default defineEventHandler((event) => {
    setResponseHeader(event, 'content-type', 'text/plain; version=0.0.4; charset=utf-8');
    setResponseHeader(event, 'cache-control', 'no-store');

    return renderPrometheusMetrics();
});
