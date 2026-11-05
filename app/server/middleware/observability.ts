import { randomUUID } from 'node:crypto';

interface ObservabilityContext {
    requestId?: string;
    requestStartedAt?: number;
}

/**
 * 请求上下文：为每个请求生成 requestId，写入 event.context 与响应头，
 * 并在响应结束时记录结构化访问日志与 RED 指标。
 *
 * 与 logger.ts 并存：logger 只打印基础访问行，这里补充 requestId、状态码与指标。
 * 本中间件只做观测，不改变请求结果，也不重复抛出错误。
 */
export default defineEventHandler((event) => {
    const requestId = randomUUID();
    const startedAt = performance.now();
    const method = event.node.req.method ?? 'GET';
    const path = getRequestURL(event).pathname;

    const context = event.context as ObservabilityContext;
    context.requestId = requestId;
    context.requestStartedAt = startedAt;

    setResponseHeader(event, 'x-request-id', requestId);
    incGauge('nuxt_http_in_flight_requests', {}, 1);

    let finished = false;

    event.node.res.on('finish', () => {
        if (finished) return;
        finished = true;

        const status = event.node.res.statusCode;
        const durationMs = performance.now() - startedAt;

        incGauge('nuxt_http_in_flight_requests', {}, -1);
        recordHttpRequest({ method, route: path, status, durationMs });

        console.log(
            JSON.stringify({
                level: status >= 500 ? 'error' : 'info',
                msg: 'http_request',
                requestId,
                method,
                path,
                status,
                durationMs: Number(durationMs.toFixed(2)),
            }),
        );
    });
});
