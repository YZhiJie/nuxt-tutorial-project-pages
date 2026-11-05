<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const { user, fetchMe, login, logout } = useAuth();

const username = ref('demo');
const password = ref('nuxt1234');
const loading = ref(false);
const errorMessage = ref('');
const notice = ref('');
const visibleCookies = ref('');

function syncVisibleCookies() {
    if (!import.meta.client) return;
    visibleCookies.value = document.cookie || '（空）';
}

onMounted(async () => {
    syncVisibleCookies();
    try {
        await fetchMe();
    } catch {
        // 未登录时 /api/auth/me 返回 user: null，不视为错误
    }
});

async function submit() {
    errorMessage.value = '';
    notice.value = '';
    loading.value = true;
    try {
        await login(username.value.trim(), password.value);
        // 再显式请求一次 /api/auth/me，验证会话 Cookie 已生效
        await fetchMe();
        notice.value = '登录成功：服务端已写入 httpOnly Cookie，后续请求自动携带';
        syncVisibleCookies();
    } catch (error) {
        errorMessage.value = getApiErrorMessage(error, '登录失败，请稍后重试');
    } finally {
        loading.value = false;
    }
}

async function signOut() {
    errorMessage.value = '';
    notice.value = '';
    try {
        await logout();
        notice.value = '已退出：服务端清除会话 Cookie';
        syncVisibleCookies();
    } catch (error) {
        errorMessage.value = getApiErrorMessage(error, '退出失败，请稍后重试');
    }
}

const userJson = computed(() => JSON.stringify(user.value, null, 2));

const FLOW_CODE = `// 1. 浏览器提交账号密码
await $fetch('/api/auth/login', {
    method: 'POST',
    body: { username: 'demo', password: 'nuxt1234' },
});

// 2. 服务端校验通过，响应头写入 Cookie
// Set-Cookie: session=demo-token;
//   HttpOnly; SameSite=Lax; Path=/; Max-Age=86400

// 3. 后续同站请求自动携带 Cookie
await $fetch('/api/auth/me'); // → { user: { name: 'demo' } }

// 4. 退出时由服务端清除
await $fetch('/api/auth/logout', { method: 'POST' });
// Set-Cookie: session=; Max-Age=0`;

const READ_CODE = `// /api/auth/me 只读取 Cookie，不信任请求体里的 user
export default defineEventHandler((event) => {
    return { user: getSessionUser(event) };
});

// 受保护接口：缺少会话直接 401
export default defineEventHandler((event) => {
    const user = requireSessionUser(event);
    return loadAdminData(user);
});`;

const CSRF_CODE = `// 防 CSRF 的三层手段
// 1) SameSite=Lax / Strict —— 首选，成本最低
setCookie(event, 'session', token, { sameSite: 'lax' });

// 2) 校验 Origin / Referer —— 写接口通用兜底
const origin = getHeader(event, 'origin');
if (origin && origin !== expectedOrigin) {
    throw createError({ statusCode: 403, message: '非法来源' });
}

// 3) 双提交 Cookie / 同步 Token —— 高风险操作再加一层
// 前端从非 httpOnly cookie 读 csrfToken，
// 请求头带 X-CSRF-Token，服务端比对两者`;

const notices = [
    '演示账号固定为 demo / nuxt1234，令牌也是写死的 demo-token，仅用于教学。',
    '生产环境会话令牌必须是高熵随机值，并在服务端存储会话状态与过期时间。',
    '退出登录要同时清理服务端会话；只清 Cookie 无法让旧会话在别处失效。',
    'Cookie 的 Secure 属性在生产必须开启，本地 http 开发环境可暂时关闭。',
];
</script>

<template>
    <DocPage
        title="Cookie 会话登录"
        description="本页直接复用项目现有的 /api/auth/login、/api/auth/me 与 /api/auth/logout：登录成功后服务端写入 httpOnly Cookie，页面再读取当前用户。"
        :tags="['登录', 'httpOnly', '会话读取', '退出']"
    >
        <DocSection id="flow" title="登录流程与 Cookie 写入" kicker="01 · FLOW">
            <p class="body-text">
                登录不是“前端保存一个用户对象”，而是服务端建立一个可信会话。
                账号密码校验通过后，服务端通过 <code>Set-Cookie</code> 下发会话标识；
                浏览器后续同站请求会自动携带，页面再也不用把令牌放进 JS 变量。
            </p>
            <CodeBlock :code="FLOW_CODE" lang="ts" title="登录 → 会话 → 退出" />
            <Callout type="info" title="httpOnly 的意义">
                设置了 <code>HttpOnly</code> 的 Cookie 对
                <code>document.cookie</code> 不可见。即使页面存在 XSS，
                攻击脚本也无法直接读取会话令牌，只能“代为发起请求”，风险面显著收窄。
            </Callout>
        </DocSection>

        <DocSection id="read" title="读取登录态" kicker="02 · READ">
            <p class="body-text">
                判断“当前是谁”的唯一可信来源是服务端会话。
                <code>/api/auth/me</code> 读取 Cookie 并返回用户；受保护接口则用
                <code>requireSessionUser</code>，未登录直接 401。
            </p>
            <CodeBlock :code="READ_CODE" lang="ts" title="服务端读取会话" />
            <p class="body-text">
                页面侧通过 <code>useAuth()</code> 收口：<code>fetchMe</code> 拉取、
                <code>login</code> 登录、<code>logout</code> 退出。SSR 场景下
                <code>fetchMe</code> 已经处理了 <code>cookie</code> 请求头转发。
            </p>
        </DocSection>

        <DocSection id="csrf" title="CSRF 与退出" kicker="03 · CSRF">
            <p class="body-text">
                Cookie 会自动携带，这既是便利也是风险：攻击者从别的站点发起写请求，
                浏览器也可能带上你的会话。防御重点是让“跨站请求”无法通过校验。
            </p>
            <CodeBlock :code="CSRF_CODE" lang="ts" title="SameSite · Origin · Token" />
            <ul class="checklist">
                <li v-for="item in notices" :key="item">{{ item }}</li>
            </ul>
        </DocSection>

        <DocSection id="demo" title="在线登录演示" kicker="04 · DEMO">
            <p class="body-text">
                表单默认填入演示账号。登录成功后页面会再次调用 <code>/api/auth/me</code>，
                展示服务端返回的用户 JSON；退出后 Cookie 被清除，用户回到未登录状态。
            </p>
            <DemoCard
                title="会话登录与退出"
                desc="账号 demo，密码 nuxt1234；登录后观察 httpOnly Cookie 与 /api/auth/me 的结果。"
                badge="LIVE"
            >
                <div v-if="user" class="logged-in">
                    <div class="status-row">
                        <span class="badge badge--accent">已登录</span>
                        <span class="muted">当前用户：{{ user.name }}</span>
                    </div>
                    <p class="me-label mono">GET /api/auth/me →</p>
                    <pre class="me-json">{{ userJson }}</pre>
                    <div class="actions">
                        <button class="btn btn--danger" type="button" @click="signOut">退出登录</button>
                        <NuxtLink to="/dashboard" class="btn btn--ghost">访问受保护页面 /dashboard →</NuxtLink>
                    </div>
                </div>

                <form v-else class="login-form" @submit.prevent="submit">
                    <label class="field">
                        <span>账号</span>
                        <input v-model="username" class="input" autocomplete="username" />
                    </label>
                    <label class="field">
                        <span>密码</span>
                        <input
                            v-model="password"
                            class="input"
                            type="password"
                            autocomplete="current-password"
                        />
                    </label>
                    <button class="btn" type="submit" :disabled="loading">
                        {{ loading ? '登录中……' : '登录' }}
                    </button>
                </form>

                <p v-if="errorMessage" class="msg msg--error">{{ errorMessage }}</p>
                <p v-if="notice" class="msg msg--ok">{{ notice }}</p>

                <p v-if="visibleCookies" class="cookie-note mono">
                    document.cookie: {{ visibleCookies }}
                    <span class="muted">（session 为 httpOnly，JS 读不到）</span>
                </p>

                <template #footer>
                    Cookie 由服务端写入，前端只负责发起请求与展示状态；切勿在 localStorage 中保存会话令牌。
                </template>
            </DemoCard>
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

.logged-in {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.status-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
}

.me-label {
    margin: 0;
    font-size: 11px;
    color: var(--text-faint);
}

.me-json {
    margin: 0;
    font-size: 12.5px;
    background: var(--bg-elevated);
}

.actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.login-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 360px;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    color: var(--text-muted);
}

.msg {
    margin: 12px 0 0;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    font-size: 13px;
}

.msg--error {
    border: 1px solid rgba(248, 113, 113, 0.4);
    background: rgba(248, 113, 113, 0.08);
    color: var(--danger);
}

.msg--ok {
    border: 1px solid var(--success-border);
    background: var(--success-soft);
    color: var(--success);
}

.cookie-note {
    margin: 12px 0 0;
    font-size: 11px;
    color: var(--text-faint);
    word-break: break-all;
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
