<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const NAV_CODE = `// 声明式：可被预取、可被爬虫抓取，优先用于导航菜单
<NuxtLink to="/routing/dynamic/42">打开详情</NuxtLink>

// 命令式：适合表单提交、删除成功、登录完成后的跳转
await navigateTo('/routing/dynamic/42');

// replace：不新增历史记录，适合“刷新详情”或修正错误地址
await navigateTo('/routing/dynamic/1', { replace: true });`;

const OPTIONS_CODE = `// 外部链接必须显式声明 external，避免被当成站内路径
await navigateTo('https://nuxt.com', {
    external: true,
    open: { target: '_blank' },
});

// 服务端重定向：navigateTo 在 SSR 阶段会写入 Location 响应头
await navigateTo('/routing/dynamic', { redirectCode: 301 });

// 原始 vue-router 跳转：只在客户端可靠，不适合 SSR 重定向
const router = useRouter();
await router.push('/routing/dynamic/42');`;

const SCROLL_CODE = `// app/router.options.ts
import type { RouterConfig } from '@nuxt/schema';

export default <RouterConfig>{
    scrollBehavior(to, from, savedPosition) {
        // 浏览器前进 / 后退：恢复上次位置
        if (savedPosition) return savedPosition;

        // 带锚点：滚动到目标元素，并给固定顶栏留出空间
        if (to.hash) return { el: to.hash, top: 80, behavior: 'smooth' };

        // 普通跳转：回到页面顶部
        return { top: 0 };
    },
};`;

const comparison = [
    { api: 'NuxtLink', render: '声明式组件', prefetch: '支持', ssr: '可抓取、无 JS 也能跳', use: '菜单、列表、详情入口' },
    { api: 'navigateTo', render: '命令式函数', prefetch: '按需', ssr: '服务端可返回重定向', use: '动作完成后跳转' },
    { api: 'router.push', render: 'vue-router 原生', prefetch: '需手动处理', ssr: '仅客户端可靠', use: '复杂客户端流程' },
];

const pitfalls = [
    '把用户输入的 URL 直接传给 navigateTo：必须做协议与域名白名单校验。',
    '在 SSR 中用 router.push 做重定向：服务端不会返回 3xx，爬虫看到的是 200。',
    '外部链接忘记 external: true，会被 vue-router 当成站内路径而 404。',
    'redirectCode 301 用于永久迁移；临时活动页请用 302，避免缓存长期生效。',
];

function goDetail() {
    return navigateTo('/routing/dynamic/42');
}

function goReplace() {
    return navigateTo('/routing/dynamic/1', { replace: true });
}
</script>

<template>
    <DocPage
        title="编程式导航"
        description="声明式 NuxtLink 负责可抓取、可预取的常规跳转；navigateTo 负责“做完一件事再跳”的命令式场景。理解两者边界，才能写出对 SSR 友好的导航。"
        :tags="['NuxtLink', 'navigateTo', 'router.push', '重定向', '滚动行为']"
    >
        <DocSection id="models" title="两种导航模型" kicker="01 · MODELS">
            <p class="body-text">
                能用 <code>NuxtLink</code> 就不要用函数跳转：它在服务端渲染成真实
                <code>a</code> 标签，天然可抓取、可预取、可中键新开。只有“动作完成后”才需要命令式导航。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>API</th><th>形态</th><th>预取</th><th>SSR 表现</th><th>典型场景</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in comparison" :key="row.api">
                            <td class="mono">{{ row.api }}</td>
                            <td>{{ row.render }}</td>
                            <td>{{ row.prefetch }}</td>
                            <td>{{ row.ssr }}</td>
                            <td>{{ row.use }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <DemoCard title="navigateTo 按钮" desc="点击按钮不会刷新页面，地址栏会立即变化。">
                <div class="nav-demo">
                    <button class="btn" @click="goDetail">navigateTo /routing/dynamic/42</button>
                    <button class="btn btn--ghost" @click="goReplace">replace 到 /routing/dynamic/1</button>
                    <NuxtLink to="/routing/dynamic" class="nav-link">NuxtLink 返回列表 →</NuxtLink>
                </div>
            </DemoCard>
        </DocSection>

        <DocSection id="navigate-to" title="navigateTo 的常用选项" kicker="02 · OPTIONS">
            <p class="body-text">
                <code>navigateTo</code> 在服务端与客户端都能执行：SSR 期间它把目标地址写进
                <code>Location</code> 响应头，客户端则交给 vue-router 做无刷新跳转。
            </p>
            <CodeBlock :code="NAV_CODE" lang="ts" title="最常用的三种写法" />
            <CodeBlock :code="OPTIONS_CODE" lang="ts" title="外部、重定向与原生 router" />
            <Callout type="tip" title="优先返回 await 结果">
                组件卸载或导航被取消时，<code>navigateTo</code> 会返回失败信息。
                在动作后需要清理 loading 状态的场景，建议 <code>await</code> 并检查结果。
            </Callout>
        </DocSection>

        <DocSection id="redirect" title="重定向与外部链接的安全边界" kicker="03 · REDIRECT">
            <p class="body-text">
                重定向目标如果来自查询参数（例如登录后的 <code>?redirect=</code>），
                就属于开放重定向风险。必须只允许站内相对路径，或校验域名白名单。
            </p>
            <div class="grid">
                <div class="card card--soft">
                    <p class="card-title">安全做法</p>
                    <ul class="plain-list">
                        <li>只接受以 / 开头的站内路径</li>
                        <li>外部域名走固定映射表</li>
                        <li>拒绝 javascript: 等协议</li>
                    </ul>
                </div>
                <div class="card card--soft">
                    <p class="card-title">危险信号</p>
                    <ul class="plain-list">
                        <li>直接 navigateTo(query.redirect)</li>
                        <li>未校验的 absolute URL</li>
                        <li>把 token 拼进跳转地址</li>
                    </ul>
                </div>
            </div>
        </DocSection>

        <DocSection id="scroll" title="滚动行为与锚点" kicker="04 · SCROLL">
            <p class="body-text">
                vue-router 默认在普通跳转后回到顶部，前进 / 后退时恢复历史位置。
                如果站点有固定顶栏，锚点滚动需要额外偏移，否则标题会被遮住。
            </p>
            <CodeBlock :code="SCROLL_CODE" lang="ts" title="自定义 scrollBehavior" />
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

.nav-demo {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
}

.nav-link {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--accent);
    border-bottom: 1px dashed var(--accent);
}

.card-title {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
}

.plain-list {
    margin: 0;
    padding-left: 18px;
    font-size: 13px;
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
    line-height: 1.7;
    color: var(--text-muted);
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
