<script setup lang="ts">
// 静态介绍页：固定 SEO 元信息
useSeoMeta({
    title: '关于 - Nuxt LearnHub',
    description: 'Nuxt LearnHub 是配套 Nuxt 教程的可运行示例项目。',
});
</script>

<template>
    <section class="card">
        <h1>关于 Nuxt LearnHub</h1>
        <p>本项目是 Nuxt 4 教程的配套示例代码，覆盖路由、数据请求、状态管理、服务端 API 等核心能力。</p>
        <p>技术栈：Nuxt 4 + Pinia + TypeScript + Vitest。</p>
    </section>
</template>
