interface WindowEntry {
    count: number;
    resetAt: number;
}

const LIMIT = 5;
const WINDOW_MS = 10_000;

// 进程内固定窗口：单实例可用；多实例部署需换成 Redis 等共享存储
const buckets = new Map<string, WindowEntry>();

export default defineEventHandler((event) => {
    setResponseHeader(event, 'Cache-Control', 'no-store');

    const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
    const now = Date.now();

    let entry = buckets.get(ip);
    if (!entry || now >= entry.resetAt) {
        entry = { count: 0, resetAt: now + WINDOW_MS };
        buckets.set(ip, entry);
    }

    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

    if (entry.count >= LIMIT) {
        setResponseHeader(event, 'Retry-After', retryAfter);
        setResponseHeader(event, 'X-RateLimit-Limit', String(LIMIT));
        setResponseHeader(event, 'X-RateLimit-Remaining', '0');

        throw createError({
            statusCode: 429,
            message: '请求过于频繁，请稍后再试',
            data: {
                limit: LIMIT,
                remaining: 0,
                retryAfter,
                windowMs: WINDOW_MS,
            },
        });
    }

    entry.count += 1;
    const remaining = LIMIT - entry.count;

    setResponseHeader(event, 'X-RateLimit-Limit', String(LIMIT));
    setResponseHeader(event, 'X-RateLimit-Remaining', String(remaining));
    setResponseHeader(event, 'X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    return {
        allowed: true,
        limit: LIMIT,
        used: entry.count,
        remaining,
        windowMs: WINDOW_MS,
        resetAt: entry.resetAt,
        retryAfter,
    };
});
