<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const route = useRoute();
const rawId = computed(() => String(route.params.id));
const numericId = computed(() => Number(rawId.value));
const seoTitle = computed(() => `动态参数 #${numericId.value} · 路由与导航`);

// 用参数生成唯一标题，避免所有详情页共享同一个 title
useSeoMeta({
    title: () => seoTitle.value,
    description: () => `原始参数 ${rawId.value}，转换后的数字为 ${numericId.value}。`,
});

const DETAIL_CODE = `const route = useRoute();

// URL 参数永远是字符串，先保留原始值用于展示
const rawId = computed(() => String(route.params.id));
const numericId = computed(() => Number(rawId.value));

if (!Number.isInteger(numericId.value)) {
    throw createError({
        statusCode: 404,
        message: '动态参数必须是整数',
    });
}`;

const SEO_CODE = `useSeoMeta({
    title: () => '动态参数 #' + numericId.value + ' · 路由与导航',
    description: () => '原始参数 ' + rawId.value,
});`;

const pitfalls = [
    '不要用 parseInt 代替 Number 后校验：parseInt("12abc") 会得到 12。',
    'Number.isInteger 会放过 0 与负数，业务若要求正整数需再加 id > 0。',
    '客户端直接改 URL 时页面可能复用，参数读取要放进 computed。',
    '校验失败必须抛错而不是 return：静默返回会渲染出空白详情页。',
];

// 非法参数在 setup 阶段直接抛出，交给全局 error.vue 渲染 404
// 放在所有常量声明之后，避免错误边界渲染时访问未初始化变量
if (!Number.isInteger(numericId.value)) {
    throw createError({
        statusCode: 404,
        message: '动态参数必须是整数',
    });
}
</script>

<template>
    <DocPage
        title="动态路由参数：详情"
        description="这是 /routing/dynamic/:id 的真实命中页。下面展示原始参数、转换结果、校验结果与动态 SEO 标题的完整链路。"
        :tags="['useRoute', 'Number.isInteger', 'createError', 'useSeoMeta']"
    >
        <DocSection id="result" title="当前匹配结果" kicker="01 · MATCH">
            <p class="body-text">
                地址栏中的最后一段被解析成 <code>route.params.id</code>。
                原始值永远是字符串，页面在展示与计算时分别保留两种形态，避免信息丢失。
            </p>
            <DemoCard title="参数快照" desc="修改地址栏中的 id 再回车，可以观察所有值同步变化。" badge="LIVE">
                <dl class="stat-grid">
                    <div class="stat">
                        <dt>原始参数 route.params.id</dt>
                        <dd class="mono">{{ rawId }}</dd>
                    </div>
                    <div class="stat">
                        <dt>转换后数字 Number(rawId)</dt>
                        <dd class="mono">{{ numericId }}</dd>
                    </div>
                    <div class="stat">
                        <dt>是否为整数</dt>
                        <dd class="mono">{{ Number.isInteger(numericId) ? 'true' : 'false' }}</dd>
                    </div>
                    <div class="stat">
                        <dt>useSeoMeta 动态标题</dt>
                        <dd class="mono">{{ seoTitle }}</dd>
                    </div>
                    <div class="stat">
                        <dt>当前路径 route.path</dt>
                        <dd class="mono">{{ route.path }}</dd>
                    </div>
                </dl>
                <template #footer>
                    <div class="demo-actions">
                        <NuxtLink to="/routing/dynamic" class="btn btn--ghost btn--sm">返回列表</NuxtLink>
                        <NuxtLink to="/routing/dynamic/1" class="btn btn--ghost btn--sm">参数 1</NuxtLink>
                        <NuxtLink to="/routing/dynamic/42" class="btn btn--ghost btn--sm">参数 42</NuxtLink>
                    </div>
                </template>
            </DemoCard>
            <CodeBlock :code="DETAIL_CODE" lang="ts" title="读取与校验" />
        </DocSection>

        <DocSection id="timing" title="校验在什么时机执行" kicker="02 · TIMING">
            <p class="body-text">
                页面 <code>setup</code> 在服务端渲染时执行一次，客户端路由切换时再执行一次。
                <code>throw createError</code> 在服务端会直接返回 404 状态码，在客户端会跳转到错误页，
                两条链路表现一致。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>访问方式</th><th>执行环境</th><th>非法参数的结果</th></tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>直接在浏览器打开</td>
                            <td>Nitro 服务端</td>
                            <td>HTTP 404，渲染 error.vue</td>
                        </tr>
                        <tr>
                            <td>站内 NuxtLink 跳转</td>
                            <td>浏览器客户端</td>
                            <td>路由进入错误态，渲染 error.vue</td>
                        </tr>
                        <tr>
                            <td>刷新或爬虫抓取</td>
                            <td>Nitro 服务端</td>
                            <td>状态码 404，SEO 不会收录</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <Callout type="tip" title="错误信息只放安全内容">
                <code>statusMessage</code> 会出现在错误页，甚至可能被日志采集。
                不要把数据库错误、堆栈或内部 ID 直接拼进去。
            </Callout>
        </DocSection>

        <DocSection id="seo" title="动态标题与描述" kicker="03 · SEO">
            <p class="body-text">
                每个详情 URL 都应有独立标题。Nuxt 的 <code>useSeoMeta</code> 支持传入函数，
                在参数变化后重新求值，避免标题停留在首次渲染的值。
            </p>
            <CodeBlock :code="SEO_CODE" lang="ts" title="按参数生成元信息" />
            <p class="body-text">
                浏览器标签页标题已经包含当前参数，可以切换到其他 id 验证：
                <NuxtLink to="/routing/dynamic/7" class="inline-link">/routing/dynamic/7</NuxtLink>
                与
                <NuxtLink to="/routing/dynamic/42" class="inline-link">/routing/dynamic/42</NuxtLink>
                的标题不同。
            </p>
        </DocSection>

        <DocSection id="pitfalls" title="常见坑" kicker="04 · PITFALLS">
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

.stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    margin: 0;
}

.stat {
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
}

.stat dt {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-faint);
}

.stat dd {
    margin: 6px 0 0;
    font-size: 15px;
    color: var(--accent);
    word-break: break-all;
}

.demo-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.inline-link {
    color: var(--accent);
    border-bottom: 1px dashed var(--accent);
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
