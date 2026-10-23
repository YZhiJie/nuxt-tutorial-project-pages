<script setup lang="ts">
// 管理后台：routeRules 将 /admin/** 标记为 ssr:false，整页纯客户端渲染
useSeoMeta({ title: '管理后台 - Nuxt LearnHub' });

const config = useRuntimeConfig();
// 构建信息占位（真实项目可在 CI 注入版本号/提交哈希）
const buildInfo = { version: '0.1.0', env: import.meta.dev ? 'development' : 'production' };
</script>

<template>
    <section>
        <h1>管理后台</h1>
        <ClientOnly>
            <div class="card">
                <p>本页为纯客户端渲染（SSR 已关闭），适合数据大屏、富文本编辑器等重客户端场景。</p>
                <p>站点名：{{ config.public.siteName }}</p>
                <p>版本：{{ buildInfo.version }}（{{ buildInfo.env }}）</p>
            </div>
            <template #fallback>
                <p>客户端组件加载中……</p>
            </template>
        </ClientOnly>
    </section>
</template>
