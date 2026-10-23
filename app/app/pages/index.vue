<script setup lang="ts">
import type { Note } from '#shared/types/note';

// 首页：拉取笔记列表（不 await，保留 pending 状态用于展示加载中）
const { data: notes, status, error } = useFetch<Note[]>('/api/notes');
</script>

<template>
    <section>
        <h1>最新笔记</h1>
        <!-- 加载中 -->
        <p v-if="status === 'pending'">加载中……</p>
        <!-- 加载失败 -->
        <p v-else-if="error">加载失败：{{ error.statusMessage ?? error.message }}</p>
        <!-- 正常渲染 -->
        <div v-else class="grid">
            <NoteCard v-for="note in notes ?? []" :key="note.id" :note="note" />
        </div>
    </section>
</template>
