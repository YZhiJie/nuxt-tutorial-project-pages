// 生产产物冒烟：启动 .output/server/index.mjs，验证模块接口与请求上下文链路。
// 用法：先 npm run build，再 npm run smoke
// 不引入任何新依赖，只使用 Node 18+ 自带的 fetch。
import { spawn } from 'node:child_process';

const port = Number(process.env.SMOKE_PORT ?? 3131);
const base = `http://127.0.0.1:${port}`;

const child = spawn(process.execPath, ['.output/server/index.mjs'], {
    env: { ...process.env, PORT: String(port), NITRO_PORT: String(port), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
});

let logs = '';
child.stdout.on('data', (chunk) => {
    logs += chunk.toString();
});
child.stderr.on('data', (chunk) => {
    logs += chunk.toString();
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path) {
    const res = await fetch(base + path);
    const text = await res.text();
    return { res, text };
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function main() {
    let online = false;
    for (let i = 0; i < 80; i += 1) {
        if (child.exitCode !== null) break;
        try {
            const { res } = await request('/api/hello');
            if (res.ok) {
                online = true;
                break;
            }
        } catch {
            // 端口还没监听，继续等
        }
        await sleep(250);
    }
    assert(online, `服务未在 20s 内就绪：\n${logs}`);

    const moduleInfo = await request('/api/lab/module-info');
    assert(moduleInfo.res.ok, `/api/lab/module-info 返回 ${moduleInfo.res.status}`);
    const body = JSON.parse(moduleInfo.text);
    assert(body.module?.name === 'learnhub-toolkit', '模块接口缺少 learnhub-toolkit 元信息');
    assert(body.module?.version === '0.1.0', `模块版本异常：${body.module?.version}`);
    assert(
        moduleInfo.res.headers.get('cache-control') === 'no-store',
        '模块接口缺少 cache-control: no-store',
    );

    const echo = await request('/api/observability/echo');
    assert(echo.res.ok, `/api/observability/echo 返回 ${echo.res.status}`);
    const echoBody = JSON.parse(echo.text);
    assert(typeof echoBody.requestId === 'string', 'echo 缺少 requestId');
    assert(
        echo.res.headers.get('x-request-id') === echoBody.requestId,
        '响应头 x-request-id 与 body.requestId 不一致',
    );

    // 错误码契约：空标题必须返回 400 + VALIDATION_FAILED，而不是裸字符串
    const invalid = await fetch(`${base}/api/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: '没有标题' }),
    });
    assert(invalid.status === 400, `POST /api/notes 非法入参返回 ${invalid.status}`);
    const invalidBody = JSON.parse(await invalid.text());
    assert(
        invalidBody.data?.error?.code === 'VALIDATION_FAILED',
        `错误响应缺少 VALIDATION_FAILED：${invalidBody.data?.error?.code}`,
    );

    // 鉴权中间件 + 错误信封：未登录必须 401 + UNAUTHORIZED，而不是默认纯文本
    const admin = await request('/api/admin/stats');
    assert(admin.res.status === 401, `/api/admin/stats 未登录返回 ${admin.res.status}`);
    const adminBody = JSON.parse(admin.text);
    assert(
        adminBody.data?.error?.code === 'UNAUTHORIZED',
        `鉴权错误缺少 UNAUTHORIZED 信封：${adminBody.data?.error?.code}`,
    );

    console.log('✓ smoke: /api/hello、module-info、echo、notes 错误码、admin 鉴权信封通过');
}

main()
    .catch((error) => {
        console.error(`✗ smoke 失败：${error.message}`);
        process.exitCode = 1;
    })
    .finally(() => {
        child.kill('SIGTERM');
    });
