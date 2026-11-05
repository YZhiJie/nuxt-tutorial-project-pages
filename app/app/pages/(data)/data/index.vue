<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const CHOICE_CODE = `// 1. 页面里声明式取数：自动 SSR + 状态同构 + key 去重
const { data, status, error, refresh } = await useFetch<Note[]>('/api/notes', {
    key: 'data-notes',
    query: { q: 'nuxt' },
});

// 2. 需要自定义组合逻辑（并行 / 链式依赖 / 第三方 SDK）
const { data: profile } = await useAsyncData('data-profile', async () => {
    const user = await $fetch<User>('/api/me');
    const posts = await $fetch<Post[]>(\`/api/users/\${user.id}/posts\`);
    return { ...user, posts };
});

// 3. 一次性命令式请求：事件回调、表单提交，无需缓存
await $fetch<Note>('/api/notes', {
    method: 'POST',
    body: { title: '新笔记', content: '正文……' },
});`;

const SSR_CODE = `// 一次页面访问的数据流
// ① 服务端渲染时：useFetch 发起请求，await 阻塞 render
const { data } = await useFetch('/api/notes', { key: 'data-notes' });

// ② Nuxt 把 data 序列化进 HTML 内的 payload
// ③ 浏览器收到 HTML：首屏已有真实内容，无需等待接口
// ④ 客户端水合：直接从 payload 读值，status 变为 success
// ⑤ 只有 refresh()、依赖变化或手动请求才会再发一次网络请求`;

const KEY_CODE = `// 同一个 key = 同一个数据源，跨组件复用且只请求一次
const { data } = await useFetch('/api/notes', { key: 'data-notes' });

// 反例：不传 key 时按调用位置生成，SSR 与客户端可能各请求一次
useFetch('/api/notes');

// key 稳定、查询条件交给 query：条件变化时自动刷新同一份缓存
const { data } = await useFetch('/api/notes', {
    key: 'data-notes',
    query: computed(() => ({ q: route.query.q ?? '' })),
});`;

const ERROR_CODE = `const { data, error, status } = await useFetch<Note[]>('/api/notes');

if (error.value) {
    // statusCode / statusMessage / data 可用于展示、埋点与降级
    throw createError({
        statusCode: error.value.statusCode ?? 500,
        statusMessage: '笔记列表加载失败',
    });
}

// 事件回调里的 $fetch：错误不会自动渲染，必须自己兜底
try {
    await $fetch('/api/notes', { method: 'POST', body });
} catch (e) {
    const message = getApiErrorMessage(e); // app/utils/api-error.ts
}`;

const table = [
    { api: 'useFetch', use: '页面 / 组件内的声明式取数', ssr: '自动参与', cache: '自动 key + payload', ret: 'AsyncData' },
    { api: 'useAsyncData', use: '自定义异步逻辑、并行或依赖请求', ssr: '自动参与', cache: '手动指定 key', ret: 'AsyncData' },
    { api: '$fetch', use: '事件回调、提交、服务端内部调用', ssr: '手动 await', cache: '无', ret: 'Promise' },
];

const principles = [
    '页面级数据用 useFetch / useAsyncData 声明在 setup 顶层，让 SSR 能在 render 前拿到数据。',
    '组件事件、表单提交、轮询用 $fetch，避免把一次性请求包装成响应式数据源。',
    'useAsyncData 的 handler 内部只调用一次 $fetch，不要再套一层可被重复触发的请求。',
    '错误分为“阻塞首屏”和“可恢复局部”两类：前者抛 createError，后者在组件内降级展示。',
];
</script>

<template>
    <DocPage
        title="数据获取与缓存"
        description="Nuxt 的数据层围绕「服务端取数 → 序列化进水合 payload → 客户端复用」设计。选对 API，比事后补缓存更重要。"
        :tags="['useFetch', 'useAsyncData', '$fetch', 'SSR 同构', '请求去重']"
    >
        <DocSection id="choice" title="三种取数 API 的边界" kicker="01 · CHOICE">
            <p class="body-text">
                <code>useFetch</code> 是 <code>useAsyncData</code> + <code>$fetch</code> 的语法糖，
                适合在页面 setup 里声明式取数；<code>useAsyncData</code> 负责异步编排与缓存键；
                <code>$fetch</code> 是最底层的命令式请求。三者的差别不在“能不能发请求”，而在
                <strong>是否参与 SSR、是否进入缓存、返回什么形态</strong>。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>API</th><th>典型场景</th><th>SSR</th><th>缓存</th><th>返回</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in table" :key="row.api">
                            <td class="mono">{{ row.api }}</td>
                            <td>{{ row.use }}</td>
                            <td>{{ row.ssr }}</td>
                            <td>{{ row.cache }}</td>
                            <td class="mono">{{ row.ret }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="CHOICE_CODE" lang="ts" title="一张图看懂三种选型" />
        </DocSection>

        <DocSection id="ssr" title="SSR 数据同构" kicker="02 · ISOMORPHIC">
            <p class="body-text">
                声明式取数之所以“同构”，是因为它同时跑在服务端与客户端：
                服务端负责拿到数据并塞进 HTML 的 payload，客户端水合时直接复用，
                既避免首屏空白，也避免同一份数据请求两次。
            </p>
            <CodeBlock :code="SSR_CODE" lang="text" title="一次请求的完整生命周期" />
            <Callout type="tip" title="判断是否真的同构">
                打开页面源码搜索接口返回值。如果 HTML 里已有数据，说明 SSR 生效；
                如果只有空壳、数据在浏览器里才出现，通常是请求被放进了 <code>onMounted</code>
                或 <code>useAsyncData</code> 的 <code>lazy</code> 模式。
            </Callout>
        </DocSection>

        <DocSection id="key" title="key 去重" kicker="03 · DEDUPLICATION">
            <p class="body-text">
                key 是缓存的唯一标识。两个组件用同一个 key 取同一份数据，Nuxt 只发一次请求；
                key 不稳定，则 SSR 与客户端各拿一份，轻则重复请求，重则水合前后数据不一致。
            </p>
            <CodeBlock :code="KEY_CODE" lang="ts" title="key 的三条规则" />
            <Callout type="warn" title="不要让 key 携带随机值">
                <code>key</code> 里出现 <code>Math.random()</code>、<code>Date.now()</code>
                或组件实例 id，会让缓存彻底失效。需要区分实例时，用业务语义（如
                <code>data-note-42</code>）而不是随机串。
            </Callout>
        </DocSection>

        <DocSection id="error" title="错误处理总览" kicker="04 · ERROR">
            <p class="body-text">
                错误有两种归宿：阻塞型（首屏必须的数据拿不到）交给
                <code>createError</code> 与全局 <code>error.vue</code>；
                局部型（可选模块、刷新失败）留在组件内展示并允许重试。
            </p>
            <CodeBlock :code="ERROR_CODE" lang="ts" title="阻塞型 vs 局部型" />
            <ul class="checklist">
                <li v-for="item in principles" :key="item">{{ item }}</li>
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
}

.checklist {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 16px 0 0;
    padding: 0;
    list-style: none;
}

.checklist li {
    position: relative;
    padding-left: 24px;
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.7;
}

.checklist li::before {
    content: '→';
    position: absolute;
    left: 0;
    color: var(--accent);
    font-family: var(--font-mono);
}
</style>
