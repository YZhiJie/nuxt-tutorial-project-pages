<script setup lang="ts">
import type { Note } from '#shared/types/note';

// 笔记卡片：整卡可点击，跳转到详情页
defineProps<{ note: Note }>();
</script>

<template>
    <NuxtLink :to="`/notes/${note.id}`" class="card note-card">
        <h3 class="note-title">{{ note.title }}</h3>
        <p class="note-excerpt">{{ note.excerpt }}</p>
        <div class="note-meta">
            <span v-for="tag in note.tags" :key="tag" class="note-tag">#{{ tag }}</span>
            <time class="note-date">{{ formatDate(note.createdAt) }}</time>
        </div>
    </NuxtLink>
</template>

<style scoped>
.note-card {
    display: block;
    transition: transform 150ms ease;
}

.note-card:hover {
    transform: translateY(-2px);
}

.note-title {
    margin: 0 0 8px;
    font-size: 17px;
}

.note-excerpt {
    margin: 0 0 12px;
    color: var(--color-text-muted);
    font-size: 14px;
}

.note-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--color-text-muted);
}

.note-tag {
    color: var(--color-primary-dark);
}

.note-date {
    margin-left: auto;
}
</style>
