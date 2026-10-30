<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const COMPARE = `// 全局中间件：middleware/logger.global.ts
// 所有路由都会执行；适合埋点、语言协商、灰度标记
export default defineNuxtRouteMiddleware((to, from) => {
    if (import.meta.client) {
        console.log('[router]', from.fullPath, '→', to.fullPath);
    }
});

// 具名中间件：middleware/auth.ts
// 只有声明过的页面执行；适合业务鉴权
export default defineNuxtRouteMiddleware(async () => {
    const { fetchMe } = useAuth();
    await fetchMe();
    if (!useUserStore().user) {
        return navigateTo('/login');
    }
});`;

const PAGE_META = `<!-- 单页面声明 -->
<script setup lang="ts">
definePageMeta({
    layout: 'docs',
    middleware: 'auth',
});
<\/script>

<!-- 多个中间件：按数组顺序执行 -->
definePageMeta({
    middleware: ['auth', 'admin-only'],
});

// 注意：中间件可以异步，但不要做重请求；
// fetchMe 已经在 store 内做了 SSR Cookie 转发，通常只拉一次。`;

const SERVER = `// 服务端中间件：所有请求先过这里
export default defineEventHandler((event) => {
    const path = getRequestURL(event).pathname;
    if (path.startsWith('/api/admin/')) {
        requireSessionUser(event); // 未登录 → 401
    }
});

// 具体接口内做资源级判断
export default defineEventHandler(async (event) => {
    const user = requireSessionUser(event);

    const record = await getRecord(Number(getRouterParam(event, 'id')));
    if (!record) {
        throw createError({ statusCode: 404, message: '记录不存在' });
    }
    if (record.owner !== user.name) {
        throw createError({ statusCode: 403, message: '无权访问该记录' });
    }
    return record;
});`;

const ERRORS = `// 前端中间件：未登录 → 去登录页，并带上回跳地址
if (!useUserStore().user) {
    return navigateTo('/login?redirect=' + encodeURIComponent(to.fullPath));
}

// 已登录但无权限 → 403 页面，不要跳登录
throw createError({ statusCode: 403, message: '无权访问' });

// 服务端：
// 401 Unauthorized —— 没有有效会话
// 403 Forbidden    —— 有会话，但当前用户无权操作该资源
// 404 Not Found    —— 资源不存在（也可用于隐藏资源存在性）`;

const pitfalls = [
    '只在客户端路由中间件判断登录，接口仍然裸奔：攻击者可直接调用 API。',
    '把 403 当作 401 处理，会把已登录用户反复踢回登录页。',
    '中间件里吞掉 fetchMe 的失败，导致异常状态下继续放行。',
    '全局中间件里做高成本权限查询，会让每个路由都变慢；业务鉴权应下沉到具名中间件或接口。',
    'SSR 下忽略 Cookie 转发，服务端会误判未登录并错误重定向。',
];
</script>

<template>
    <DocPage
        title="路由守卫"
        description="路由守卫解决页面访问体验，接口守卫解决数据安全。两者必须同时存在，且要正确区分未登录（401）与无权限（403）。"
        :tags="['全局中间件', '具名中间件', 'definePageMeta', '401', '403']"
    >
        <DocSection id="types" title="全局 vs 具名中间件" kicker="01 · TYPES">
            <p class="body-text">
                Nuxt 的路由中间件按文件命名区分：带 <code>.global</code> 后缀的在所有路由执行，
                其余为具名中间件，只在页面显式声明时执行。全局中间件适合横切逻辑，
                具名中间件适合业务鉴权，职责不要混用。
            </p>
            <CodeBlock :code="COMPARE" lang="ts" title="两种中间件" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>类型</th><th>触发范围</th><th>典型用途</th><th>性能要求</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>全局 .global.ts</td><td>所有路由</td><td>日志、语言、灰度、埋点</td><td>必须极轻</td></tr>
                        <tr><td>具名 auth.ts</td><td>声明该中间件的页面</td><td>登录校验、角色校验</td><td>可做一次会话读取</td></tr>
                        <tr><td>服务端中间件</td><td>所有 API 请求</td><td>接口鉴权、审计、限流</td><td>按路径前缀快速判断</td></tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="declare" title="definePageMeta 声明" kicker="02 · DECLARE">
            <p class="body-text">
                页面通过 <code>definePageMeta</code> 声明布局、中间件与渲染模式。
                中间件数组按声明顺序执行；任意一个返回 <code>navigateTo</code>
                都会中止后续导航。
            </p>
            <CodeBlock :code="PAGE_META" lang="vue" title="页面元信息" />
            <Callout type="tip" title="守卫失败要带回跳地址">
                未登录跳转时记录 <code>redirect</code>，登录成功后回到原页面，
                避免用户丢失正在进行的操作上下文。
            </Callout>
        </DocSection>

        <DocSection id="server" title="服务端中间件与接口鉴权" kicker="03 · SERVER">
            <p class="body-text">
                客户端中间件只影响页面渲染。真正保护数据的是服务端：既可以在中间件按路径统一拦截，
                也可以在接口内做资源级授权。前者负责“必须登录”，后者负责“能不能动这一条”。
            </p>
            <CodeBlock :code="SERVER" lang="ts" title="服务端守卫 + 资源级授权" />
            <Callout type="danger" title="默认拒绝">
                服务端应默认拒绝所有未明确允许的操作。不要写“如果是管理员就拒绝，否则放行”这类反向逻辑，
                新角色加入时极易越权。
            </Callout>
        </DocSection>

        <DocSection id="status" title="401 与 403 的区分" kicker="04 · STATUS">
            <p class="body-text">
                401 表示“身份不成立”，需要重新认证；403 表示“身份成立但权限不足”，
                重新登录没有意义。前端提示与跳转策略必须按语义分流。
            </p>
            <CodeBlock :code="ERRORS" lang="ts" title="状态码与跳转策略" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>状态码</th><th>含义</th><th>前端动作</th></tr>
                    </thead>
                    <tbody>
                        <tr><td class="mono">401</td><td>无会话 / 会话过期</td><td>清理本地用户，跳登录页并带回跳地址</td></tr>
                        <tr><td class="mono">403</td><td>已登录但无权限</td><td>展示无权限提示，不跳登录</td></tr>
                        <tr><td class="mono">404</td><td>资源不存在或刻意隐藏</td><td>展示不存在，避免泄露资源存在性</td></tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="pitfalls" title="常见陷阱" kicker="05 · PITFALLS">
            <ul class="checklist">
                <li v-for="item in pitfalls" :key="item">{{ item }}</li>
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
    margin: 0;
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
