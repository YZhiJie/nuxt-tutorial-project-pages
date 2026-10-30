import { setTimeout as delay } from 'node:timers/promises';

const CHUNK_SIZE = 2;
const CHUNK_DELAY_MS = 35;

function buildReply(prompt: string) {
    return `你问的是「${prompt}」。

这是一段由 Nitro 服务端分块下发的示例文本。它不调用任何外部模型，只演示流式传输的工程细节：

1. 响应头使用 text/plain; charset=utf-8，浏览器逐块解码，不必等待完整 JSON。
2. 服务端每 2 个字符写一次，并主动让出事件循环，避免长任务阻塞其他请求。
3. 当 res.write 返回 false 时，说明内核缓冲区已满，必须等待 drain 事件，这就是背压。
4. 客户端关闭连接后，res 的 close 事件会触发，循环立即停止，不会继续空转。

真正接入模型时，把这里的文本换成上游 SDK 返回的流即可：
鉴权、配额、密钥与内容审核都应留在服务端，浏览器只拿到已经过处理的增量。`;
}

export default defineEventHandler(async (event) => {
    const body = await readBody<{ prompt?: unknown }>(event).catch(() => ({ prompt: undefined }));
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';

    if (!prompt) {
        throw createError({ statusCode: 400, message: '请输入要生成的内容' });
    }

    const res = event.node.res;

    setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8');
    setResponseHeader(event, 'Cache-Control', 'no-store, no-transform');
    setResponseHeader(event, 'X-Accel-Buffering', 'no');

    res.statusCode = 200;
    res.flushHeaders?.();

    let closed = false;
    res.on('close', () => {
        closed = true;
    });

    const waitForDrain = () =>
        new Promise<void>((resolve) => {
            const done = () => {
                res.off('drain', done);
                res.off('close', done);
                resolve();
            };
            res.once('drain', done);
            res.once('close', done);
        });

    const text = buildReply(prompt);

    for (let index = 0; index < text.length; index += CHUNK_SIZE) {
        if (closed) break;

        const chunk = text.slice(index, index + CHUNK_SIZE);
        const writable = res.write(chunk);

        if (!writable) {
            // 内核缓冲区已满：等待 drain，或客户端提前断开
            await waitForDrain();
        }

        await delay(CHUNK_DELAY_MS);
    }

    if (!closed) {
        res.end();
    }
});
