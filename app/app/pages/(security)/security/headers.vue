<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const CONFIG = `// nuxt.config.ts（现有配置，本页只讲解，不做修改）
routeRules: {
    '/security/headers': {
        headers: {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        },
    },
}`;

const CURL = `# 启动 dev server 后，直接看响应头
curl -I http://localhost:3000/security/headers

# 只看关心的字段
curl -sI http://localhost:3000/security/headers \\
  | grep -Ei 'content-type-options|frame-options|referrer-policy|permissions-policy|content-security-policy|strict-transport-security'`;

const CSP = `# 生产建议（当前项目尚未启用，需结合资源实际来源调整）
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{random}';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  object-src 'none';
  upgrade-insecure-requests`;

const HSTS = `# 仅在 HTTPS 响应中设置；本地 HTTP 不要开启
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload

# 上线顺序建议：
# 1) 先确认全站 HTTPS 与子域证书
# 2) max-age 从 300 秒开始观察
# 3) 逐步提高并加 includeSubDomains
# 4) 最后再考虑 preload（进入浏览器内置列表后撤回很慢)`;

const headers = [
    {
        name: 'X-Content-Type-Options',
        value: 'nosniff',
        why: '禁止浏览器猜测 MIME 类型，防止把用户上传内容当作脚本执行。',
        risk: '缺失时，伪装成图片的 HTML/JS 可能被浏览器执行。',
    },
    {
        name: 'X-Frame-Options',
        value: 'DENY',
        why: '禁止页面被任意站点 iframe 嵌套，防点击劫持。',
        risk: '缺失时，攻击者可用透明 iframe 诱导用户点击。',
    },
    {
        name: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
        why: '跨站只发送来源 origin，HTTPS→HTTP 降级时不发送 Referer。',
        risk: '宽松策略会把带查询参数的完整 URL 泄露给第三方。',
    },
    {
        name: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
        why: '显式关闭不需要的浏览器能力，减少被滥用面。',
        risk: '默认放行时，第三方脚本可请求敏感设备权限。',
    },
];

const cspPoints = [
    '先用 Content-Security-Policy-Report-Only 收集违规，再切换为强制模式，避免上线即白屏。',
    "避免 script-src 'unsafe-inline'；Nuxt 的水合内联脚本需要 nonce 或 hash，按请求生成并注入。",
    "frame-ancestors 'none' 是 X-Frame-Options 的现代替代，建议两者同时保留以兼容旧浏览器。",
    "base-uri 'self' 阻止攻击者通过 <base> 改写相对路径；form-action 限制表单提交目标。",
    'connect-src 要显式列出 API、WebSocket 与第三方域名，否则前端请求会被直接拦截。',
];
</script>

<template>
    <DocPage
        title="安全响应头与 CSP"
        description="响应头是浏览器侧最便宜的安全控制：一行配置就能改变 MIME 嗅探、iframe 嵌套、Referer 泄露与设备权限。CSP 则是其中约束最强、也最容易配错的一项。"
        :tags="['响应头', 'CSP', 'HSTS', 'nosniff', '点击劫持']"
    >
        <DocSection id="existing" title="已配置的四个响应头" kicker="01 · EXISTING">
            <p class="body-text">
                项目在 <code>nuxt.config.ts</code> 的 <code>routeRules</code> 中，
                为 <code>/security/headers</code> 这一路由配置了四个基础安全头，
                dev 与 build 都会生效。注意 <code>routeRules</code> 是按路径匹配的，
                其他页面不会自动继承，生产上通常用全局中间件统一注入。
            </p>
            <CodeBlock :code="CONFIG" lang="ts" title="nuxt.config.ts（现有）" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>响应头</th><th>值</th><th>解决什么</th><th>缺失风险</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="header in headers" :key="header.name">
                            <td class="mono">{{ header.name }}</td>
                            <td class="mono header-value">{{ header.value }}</td>
                            <td>{{ header.why }}</td>
                            <td>{{ header.risk }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <Callout type="info" title="X-Frame-Options 与 CSP 的关系">
                <code>X-Frame-Options</code> 是旧标准，现代浏览器更推荐
                <code>CSP frame-ancestors</code>。两者同时配置不会冲突，
                旧浏览器读前者，新浏览器以 CSP 为准。
            </Callout>
        </DocSection>

        <DocSection id="verify" title="用 curl 验证" kicker="02 · VERIFY">
            <p class="body-text">
                响应头只能由 HTTP 响应决定，<code>&lt;meta http-equiv&gt;</code>
                不能替代。验证时直接看响应头，不要只看浏览器开发者工具的缓存版本。
            </p>
            <CodeBlock :code="CURL" lang="bash" title="查看当前路由的响应头" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>检查项</th><th>期望</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>状态码</td><td class="mono">200</td></tr>
                        <tr><td>X-Content-Type-Options</td><td class="mono">nosniff</td></tr>
                        <tr><td>X-Frame-Options</td><td class="mono">DENY</td></tr>
                        <tr><td>Referrer-Policy</td><td class="mono">strict-origin-when-cross-origin</td></tr>
                        <tr><td>Permissions-Policy</td><td class="mono">camera=(), microphone=(), geolocation=()</td></tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="csp" title="CSP 要点" kicker="03 · CSP">
            <p class="body-text">
                CSP 通过白名单限制“页面能加载什么、能连到哪里、能不能被嵌套”。
                它不是简单加一行 <code>default-src 'self'</code> 就结束：
                脚本来源、内联脚本、样式、字体、图片、API 与 WebSocket 都要逐项确认。
            </p>
            <CodeBlock :code="CSP" lang="http" title="CSP 指令示例" />
            <ul class="checklist">
                <li v-for="point in cspPoints" :key="point">{{ point }}</li>
            </ul>
            <Callout type="warn" title="当前项目尚未启用 CSP">
                现有 <code>routeRules</code> 只包含四个基础头，没有
                <code>Content-Security-Policy</code> 与
                <code>Strict-Transport-Security</code>。
                上面的 CSP 属于生产建议，需要结合实际资源域名与 Nuxt 内联脚本策略后再启用。
            </Callout>
        </DocSection>

        <DocSection id="hsts" title="HSTS 与上线顺序" kicker="04 · HSTS">
            <p class="body-text">
                HSTS 告诉浏览器“以后访问这个域名必须走 HTTPS”，从而阻断 SSL 剥离攻击。
                它的副作用很强：一旦下发，浏览器会在有效期内拒绝 HTTP 连接，
                因此必须确认全站与子域都支持 HTTPS 后再开启。
            </p>
            <CodeBlock :code="HSTS" lang="http" title="Strict-Transport-Security" />
            <Callout type="danger" title="本地开发不要开 HSTS">
                在 <code>localhost</code> 或 HTTP 环境开启 HSTS，浏览器可能长期强制跳转 HTTPS，
                导致本地开发无法访问，清理成本很高。
            </Callout>
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

.header-value {
    color: var(--accent);
    font-size: 11px;
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
