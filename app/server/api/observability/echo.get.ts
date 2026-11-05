interface ObservabilityContext {
    requestId?: string;
    requestStartedAt?: number;
}

/**
 * 回显请求上下文：用于证明 requestId 已写入 event.context。
 * duration 是从中间件开始到接口执行所经过的毫秒数。
 */
export default defineEventHandler((event) => {
    setResponseHeader(event, 'cache-control', 'no-store');

    const context = event.context as ObservabilityContext;
    const startedAt = context.requestStartedAt ?? performance.now();

    return {
        requestId: context.requestId ?? 'unknown',
        now: new Date().toISOString(),
        duration: Number((performance.now() - startedAt).toFixed(2)),
    };
});
