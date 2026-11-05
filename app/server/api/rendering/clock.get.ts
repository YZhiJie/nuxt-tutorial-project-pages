/**
 * 实时时钟接口：用于演示 SSR 的“每请求渲染”。
 * 响应不能被任何中间层缓存，否则页面上的时间会停在旧值。
 */
export default defineEventHandler((event) => {
    setResponseHeader(event, 'cache-control', 'no-store');

    return {
        now: new Date().toISOString(),
        // 每次请求生成新的关联 ID，便于把页面与日志串起来
        requestId: crypto.randomUUID(),
    };
});
