<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const CONFIG_CODE = `// nuxt.config.ts
export default defineNuxtConfig({
    runtimeConfig: {
        // 仅服务端可见，生产用 NUXT_API_SECRET 环境变量覆盖
        apiSecret: 'dev-secret',
        public: {
            // 会进入客户端 bundle，任何人可见
            siteName: 'Nuxt 企业工程练功房',
        },
    },
});

// 服务端接口：只有这里能读到私有配置
const secret = useRuntimeConfig(event).apiSecret;

// 客户端组件里 runtimeConfig.apiSecret 不存在
// 想“藏”在 public 里的密钥等于公开`;

const BOUNDARY_CODE = `// 可信代码边界：server/ 目录不会被客户端打包
// server/utils/auth/session.ts —— 会话、密钥、数据库连接
// server/api/** —— 校验、授权、审计

// 页面 / 组件只拿结果，不拿敏感能力
const { user } = useAuth(); // 只有 name 等展示字段

// 不要把这些值放进响应：
// - 密码哈希、会话令牌
// - 数据库连接串、第三方 API Key
// - 内部错误堆栈与 SQL 语句

throw createError({ statusCode: 500, message: '服务暂时不可用' });`;

const RUNTIME_CODE = `// 1) 授权：先认证，再资源级判断
const user = requireSessionUser(event);
if (record.owner !== user.name && user.role !== 'admin') {
    throw createError({ statusCode: 403, message: '无权访问' });
}

// 2) 限流：固定窗口，超限 429 + Retry-After
// server/api/security/rate-limit.get.ts

// 3) 输入：长度、类型、枚举、文件 magic bytes，全部在服务端重算
const size = Number(getHeader(event, 'content-length') ?? 0);
if (size > 2 * 1024 * 1024) {
    throw createError({ statusCode: 413, message: '文件过大' });
}

// 4) 出站：URL 白名单 + 私网段拦截，防 SSRF
await assertSafeOutboundUrl(target);`;

const HEADERS_CODE = `// nuxt.config.ts（项目已配置，页面只做讲解）
routeRules: {
    '/security/headers': {
        headers: {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        },
    },
}

// 验证
// curl -I http://localhost:3000/security/headers`;

const layers = [
    {
        name: '构建期',
        goal: '秘密不进客户端',
        controls: '私有 runtimeConfig、server/ 边界、依赖审计、构建产物扫描',
        failure: '密钥被打进 JS bundle，任何人可提取',
    },
    {
        name: '运行期',
        goal: '默认拒绝、最小权限',
        controls: '会话校验、RBAC、资源级授权、限流、上传校验、出站白名单',
        failure: '越权读写、暴力破解、恶意文件、SSRF 打内网',
    },
    {
        name: '传输层',
        goal: '连接不可被降级或篡改',
        controls: 'HTTPS、HSTS、Secure Cookie、CSP、nosniff、frame-ancestors',
        failure: '中间人窃听、点击劫持、XSS 注入执行',
    },
];

const checklist = [
    '任何密钥只放在私有 runtimeConfig，并确认客户端 bundle 中搜不到。',
    '所有接口默认拒绝，显式放行的动作才通过；不要依赖前端隐藏按钮。',
    '写接口同时校验身份、角色、资源归属与输入合法性。',
    '失败信息不返回堆栈、SQL、内部路径；日志里记录 requestId 供排查。',
    '生产启用 HTTPS、HSTS 与 Secure Cookie；CSP 从 Report-Only 逐步收紧。',
];
</script>

<template>
    <DocPage
        title="安全防线"
        description="安全不是一个中间件能解决的，而是构建期、运行期与传输层三道防线叠加。任何一道单独存在，都不足以支撑企业级应用。"
        :tags="['构建期', '运行期', '传输层', 'CSP', '最小权限']"
    >
        <DocSection id="layers" title="三道防线总览" kicker="01 · LAYERS">
            <p class="body-text">
                把安全按“什么时候生效”分层，更容易定位责任：
                构建期决定哪些东西能进入产物，运行期决定每次请求能做什么，
                传输层决定数据在网络与浏览器中如何被保护。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>防线</th><th>目标</th><th>主要手段</th><th>典型失守</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="layer in layers" :key="layer.name">
                            <td class="layer-name">{{ layer.name }}</td>
                            <td>{{ layer.goal }}</td>
                            <td>{{ layer.controls }}</td>
                            <td>{{ layer.failure }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="build" title="构建期：server-only 与私有配置" kicker="02 · BUILD">
            <p class="body-text">
                最常见的泄露不是被攻破，而是密钥被<strong>打包进前端</strong>。
                私有 <code>runtimeConfig</code> 只在服务端存在，<code>public</code>
                会进入客户端 bundle。把秘密写进 <code>public</code>，等于发布到公网。
                “server-only”的核心就是让敏感模块只能被服务端导入；
                Nuxt 的 <code>server/</code> 目录不会进入客户端 bundle，是最直接的边界。
            </p>
            <CodeBlock :code="CONFIG_CODE" lang="ts" title="私有 vs 公开配置" />
            <CodeBlock :code="BOUNDARY_CODE" lang="ts" title="server/ 边界与错误信息" />
            <Callout type="warn" title="环境变量不会自动安全">
                环境变量只是注入手段，是否暴露取决于你把它放在
                <code>runtimeConfig</code> 还是 <code>public</code>。
                发布前应在构建产物中搜索密钥前缀做一次确认。
            </Callout>
        </DocSection>

        <DocSection id="runtime" title="运行期：授权、限流与输入" kicker="03 · RUNTIME">
            <p class="body-text">
                运行期的总原则是<strong>默认拒绝 + 最小权限</strong>。
                每个请求都要重新回答：你是谁、你能做什么、你操作的是不是你的资源、
                这次请求的输入是否合法。缓存与前端状态都不能替代这些判断。
            </p>
            <CodeBlock :code="RUNTIME_CODE" lang="ts" title="四类运行期控制" />
            <div class="grid grid--two">
                <div class="mini-card">
                    <h3>授权</h3>
                    <p>RBAC 管功能级，owner 判断管资源级；两者缺一不可。</p>
                </div>
                <div class="mini-card">
                    <h3>限流</h3>
                    <p>保护登录、搜索、写接口；超限 429 并告诉客户端何时重试。</p>
                </div>
                <div class="mini-card">
                    <h3>上传</h3>
                    <p>大小、扩展名之外的 magic bytes、文件名净化与存储隔离。</p>
                </div>
                <div class="mini-card">
                    <h3>出站</h3>
                    <p>白名单域名 + 私网段拦截，防止 SSRF 读取内网服务。</p>
                </div>
            </div>
        </DocSection>

        <DocSection id="transport" title="传输层：响应头与 HTTPS" kicker="04 · TRANSPORT">
            <p class="body-text">
                传输层防护由服务端响应头与部署配置共同完成。本项目已在
                <code>routeRules</code> 中为 <code>/security/headers</code>
                配置了基础安全头，详细解读见下一页。
            </p>
            <CodeBlock :code="HEADERS_CODE" lang="ts" title="现有响应头配置" />
            <Callout type="info" title="HTTPS 是前提">
                HSTS 只在 HTTPS 响应中生效；没有 HTTPS，Secure Cookie 也不会发送。
                传输层的第一件事永远是启用 TLS，而不是加一堆响应头。
            </Callout>
        </DocSection>

        <DocSection id="checklist" title="发布前检查单" kicker="05 · CHECKLIST">
            <ul class="checklist">
                <li v-for="item in checklist" :key="item">{{ item }}</li>
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

.body-text strong {
    color: var(--text);
    font-weight: 600;
}

.layer-name {
    font-weight: 600;
    color: var(--accent);
    white-space: nowrap;
}

.mini-card {
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
}

.mini-card h3 {
    margin: 0 0 6px;
    font-size: 14px;
}

.mini-card p {
    margin: 0;
    font-size: 13px;
    line-height: 1.65;
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
