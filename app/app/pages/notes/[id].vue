<script setup lang="ts">
import type { Note } from '#shared/types/note';

const route = useRoute();

// 路由校验：id 必须是纯数字，否则进入 404 错误页
definePageMeta({
    validate: async (route) => /^\d+$/.test(String(route.params.id)),
});

const { data: note, error } = await useFetch<Note>(`/api/notes/${route.params.id}`);

// 接口 404 时把错误抛给全局错误页（error.vue）
if (error.value) {
    throw createError({
        statusCode: error.value.statusCode ?? 500,
        statusMessage: error.value.statusMessage ?? '笔记加载失败',
        fatal: true,
    });
}

// 按笔记内容动态设置 SEO 元信息
useSeoMeta({
    title: () => (note.value ? `${note.value.title} - Nuxt LearnHub` : '笔记详情'),
    description: () => note.value?.excerpt ?? '',
});

// 删除笔记后返回首页
async function onDelete() {
    await $fetch(`/api/notes/${route.params.id}`, { method: 'DELETE' });
    await navigateTo('/');
}
</script>

<template>
    <article v-if="note" class="card note-detail">
        <h1>{{ note.title }}</h1>
        <div class="note-meta">
            <span v-for="tag in note.tags" :key="tag" class="note-tag">#{{ tag }}</span>
            <time>{{ formatDate(note.createdAt) }}</time>
        </div>
        <p class="note-content">{{ note.content }}</p>
        <div class="note-actions">
            <NuxtLink class="btn btn--ghost" to="/">返回列表</NuxtLink>
            <button class="btn btn--danger" @click="onDelete">删除</button>
        </div>
    </article>
</template>

<style scoped>
.note-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-text-muted);
    font-size: 13px;
    margin-bottom: 16px;
}

.note-tag {
    color: var(--color-primary-dark);
}

.note-content {
    white-space: pre-wrap;
}

.note-actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;
}
</style>
