const INTERVAL_MS = 1500;

export default defineEventHandler(async (event) => {
    const res = event.node.res;
    const req = event.node.req;

    setResponseHeader(event, 'Content-Type', 'text/event-stream; charset=utf-8');
    setResponseHeader(event, 'Cache-Control', 'no-cache, no-transform');
    setResponseHeader(event, 'Connection', 'keep-alive');
    // 关闭 Nginx / 网关的缓冲，否则客户端会一次收到整段内容
    setResponseHeader(event, 'X-Accel-Buffering', 'no');

    res.statusCode = 200;
    res.flushHeaders?.();

    let closed = false;
    let count = 0;
    let timer: ReturnType<typeof setInterval> | undefined;

    const send = (chunk: string) => {
        if (closed) return false;
        try {
            res.write(chunk);
            return true;
        } catch {
            closed = true;
            return false;
        }
    };

    const cleanup = () => {
        if (closed) return;
        closed = true;
        if (timer) {
            clearInterval(timer);
            timer = undefined;
        }
        try {
            res.end();
        } catch {
            // 连接可能已经被对端断开
        }
    };

    // retry 告诉 EventSource 断线后多久重连（毫秒）
    send('retry: 3000\n\n');
    send(`event: ready\ndata: ${JSON.stringify({ connectedAt: Date.now(), intervalMs: INTERVAL_MS })}\n\n`);
    send(': connected\n\n');

    timer = setInterval(() => {
        count += 1;
        send(`event: tick\ndata: ${JSON.stringify({ count, now: Date.now() })}\n\n`);

        // 每 10 个 tick 补一条注释心跳，保持中间代理不回收空闲连接
        if (count % 10 === 0) {
            send(': heartbeat\n\n');
        }
    }, INTERVAL_MS);

    // 双保险：响应关闭与请求关闭都可能先触发
    res.on('close', cleanup);
    req.on('close', cleanup);

    // handler 必须挂起到连接关闭，否则 Nitro 会提前结束响应
    await new Promise<void>((resolve) => {
        const done = () => {
            cleanup();
            resolve();
        };
        res.once('close', done);
        req.once('close', done);
    });
});
