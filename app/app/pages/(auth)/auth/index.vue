<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const SESSION_CODE = `// server/utils/auth/session.ts（现有实现，节选）
const SESSION_COOKIE = 'session';
const SESSION_TOKEN = 'demo-token';

export function setAuthSession(event: H3Event) {
    setCookie(event, SESSION_COOKIE, SESSION_TOKEN, {
        httpOnly: true,      // JS 读不到，降低 XSS 窃取风险
        sameSite: 'lax',     // 跨站 POST 默认不带 Cookie
        secure: true,        // 仅 HTTPS（生产必须开启）
        path: '/',
        maxAge: 60 * 60 * 24,
    });
}

export function getSessionUser(event: H3Event) {
    return getCookie(event, SESSION_COOKIE) === SESSION_TOKEN
        ? demoUser
        : null;
}`;

const JWT_CODE = `// JWT 方案：状态放在客户端
// 优点：无服务端会话存储，易横向扩展
// 代价：撤销困难、体积大、必须防 XSS

const token = await $fetch('/api/auth/login', {
    method: 'POST',
    body: { username, password },
});

// 不推荐：localStorage 可被任意脚本读取
localStorage.setItem('token', token);

// 可接受：httpOnly Cookie + SameSite
// 但需要额外防 CSRF，且“退出”只能清 Cookie，
// 旧 token 在到期前仍然有效。`;

const READ_CODE = `// 读取登录态：统一走 /api/auth/me
const { user, fetchMe } = useAuth();

// SSR 阶段浏览器 Cookie 不会自动带到内部 $fetch，
// 必须显式转发，否则服务端永远读到未登录
const headers = import.meta.server
    ? useRequestHeaders(['cookie'])
    : undefined;

const state = await $fetch<AuthState>('/api/auth/me', { headers });

// user 是只读 computed，写入由 store 内部完成
// 页面只消费 user.value / user?.name`;

const MIDDLEWARE_CODE = `// app/middleware/auth.ts（具名中间件）
export default defineNuxtRouteMiddleware(async () => {
    const { fetchMe } = useAuth();
    await fetchMe();
    if (!useUserStore().user) {
        return navigateTo('/login');
    }
});

// 页面声明使用
definePageMeta({ middleware: 'auth' });

// 全局中间件：文件名带 .global.ts，所有路由都执行
// 只适合埋点、语言协商等轻逻辑，不要塞业务鉴权`;

const GUARD_CODE = `// 服务端中间件：/api/admin/** 必须登录（现有实现）
export default defineEventHandler((event) => {
    const path = getRequestURL(event).pathname;
    if (path.startsWith('/api/admin/')) {
        requireSessionUser(event); // 未登录抛 401
    }
});

// 业务接口内做资源级授权
const user = requireSessionUser(event);
if (record.owner !== user.name && user.role !== 'admin') {
    throw createError({ statusCode: 403, message: '无权访问该资源' });
}`;

const compare = [
    { dim: '状态位置', cookie: '服务端（会话表 / Redis）', jwt: '客户端签名令牌' },
    { dim: '撤销能力', cookie: '随时删除会话，立即失效', jwt: '需黑名单或短过期 + 刷新令牌' },
    { dim: '水平扩展', cookie: '需共享会话存储', jwt: '无状态，天然易扩展' },
    { dim: '体积', cookie: '只存随机 sessionId', jwt: '随 claim 增多而变大' },
    { dim: 'XSS 风险', cookie: 'httpOnly 下不可被 JS 读取', jwt: '存 localStorage 时风险高' },
    { dim: 'CSRF 风险', cookie: '依赖 Cookie，需 SameSite / Token', jwt: '放 Authorization 头可天然规避' },
];
</script>

<template>
    <DocPage
        title="认证与会话"
        description="认证回答“你是谁”，会话负责“下一次请求如何证明还是你”。选 Cookie 会话还是 JWT，本质是在撤销能力、扩展性与攻击面之间取舍。"
        :tags="['Cookie 会话', 'JWT', 'httpOnly', 'CSRF', '路由守卫']"
    >
        <DocSection id="compare" title="Cookie 会话 vs JWT" kicker="01 · COMPARE">
            <p class="body-text">
                两种方案都能实现登录，但状态存放位置不同。
                Cookie 会话把状态留在服务端，浏览器只持有一个不透明的 sessionId；
                JWT 把用户信息与签名放进令牌，由客户端携带、服务端验签。
                企业后台通常优先 Cookie 会话，因为“踢下线 / 改权限立即生效”是刚需。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>维度</th><th>Cookie 会话</th><th>JWT</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in compare" :key="row.dim">
                            <td>{{ row.dim }}</td>
                            <td>{{ row.cookie }}</td>
                            <td>{{ row.jwt }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="JWT_CODE" lang="ts" title="JWT 的代价" />
        </DocSection>

        <DocSection id="cookie" title="Cookie 安全属性" kicker="02 · COOKIE">
            <p class="body-text">
                Cookie 是认证体系里最容易被忽略的攻击面。本项目的登录接口写入
                <code>httpOnly</code> Cookie，前端拿不到令牌，XSS 也无法直接读取；
                <code>SameSite=Lax</code> 则阻止大多数跨站写请求自动携带 Cookie。
            </p>
            <CodeBlock :code="SESSION_CODE" lang="ts" title="现有会话实现" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>属性</th><th>作用</th><th>缺失后果</th></tr>
                    </thead>
                    <tbody>
                        <tr><td class="mono">HttpOnly</td><td>禁止 document.cookie 读取</td><td>XSS 可直接窃取会话</td></tr>
                        <tr><td class="mono">Secure</td><td>仅 HTTPS 发送</td><td>明文网络可被中间人截获</td></tr>
                        <tr><td class="mono">SameSite</td><td>限制跨站携带</td><td>CSRF 风险显著上升</td></tr>
                        <tr><td class="mono">Path</td><td>限制作用路径</td><td>无关接口也会携带，扩大暴露面</td></tr>
                        <tr><td class="mono">Max-Age</td><td>控制会话时长</td><td>长期有效令牌难以回收</td></tr>
                    </tbody>
                </table>
            </div>
            <Callout type="warn" title="CSRF 不是 Cookie 自动解决的">
                <p>
                    SameSite 能挡住大多数跨站表单提交，但不能替代全部防护。
                    对高风险写操作，仍应校验 <code>Origin / Referer</code>，
                    或使用双提交 Cookie / 同步 Token 模式。
                </p>
            </Callout>
        </DocSection>

        <DocSection id="read" title="登录态读取与 SSR 转发" kicker="03 · READ">
            <p class="body-text">
                页面不要各自读取 Cookie，而是统一调用 <code>/api/auth/me</code>。
                SSR 时浏览器 Cookie 不会自动附加到内部请求，必须显式转发
                <code>cookie</code> 请求头，否则服务端渲染会误判为未登录。
            </p>
            <CodeBlock :code="READ_CODE" lang="ts" title="SSR 下的登录态读取" />
            <Callout type="tip" title="状态放在 Pinia，读取放在 composable">
                现有 <code>useAuth()</code> 统一收口 <code>user store</code> 的登录、退出与
                <code>fetchMe</code>。页面只依赖 composable，不直接操作 Pinia，便于后续替换实现。
            </Callout>
        </DocSection>

        <DocSection id="guard" title="路由守卫与接口守卫" kicker="04 · GUARD">
            <p class="body-text">
                前端中间件负责“页面体验”，服务端中间件与接口内校验负责“数据安全”。
                只在路由中间件里判断登录，等于只锁了前门：攻击者可以直接请求接口。
            </p>
            <CodeBlock :code="MIDDLEWARE_CODE" lang="ts" title="具名路由中间件" />
            <CodeBlock :code="GUARD_CODE" lang="ts" title="服务端守卫与资源级授权" />
            <ul class="checklist">
                <li>全局中间件只做轻量横切逻辑；业务鉴权用具名中间件按页面声明。</li>
                <li>中间件里跳登录页前，先确认是 401（未登录）而不是 403（无权限）。</li>
                <li>403 不应跳登录页，否则已登录用户会被反复弹回登录。</li>
                <li>服务端返回 401 时，前端清理本地用户状态并引导重新登录。</li>
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

.checklist {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 14px 0 0;
    padding: 0;
    list-style: none;
}

.checklist li {
    position: relative;
    padding-left: 26px;
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.7;
}

.checklist li::before {
    content: '✓';
    position: absolute;
    left: 0;
    top: 0;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 11px;
}
</style>
