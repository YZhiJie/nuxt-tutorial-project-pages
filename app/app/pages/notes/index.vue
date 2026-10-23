<script setup lang="ts">
import type { Note } from '#shared/types/note';

const route = useRoute();
const router = useRouter();

// 搜索关键字（输入框绑定，初始值取自地址栏 ?q=）
const keyword = ref(String(route.query.q ?? ''));

// 输入变化：写回地址栏 query
watch(keyword, (value) => {
    router.replace({ query: value ? { q: value } : {} });
});

// 响应式 query：地址栏变化自动触发重新请求
const query = computed(() => (route.query.q ? { q: String(route.query.q) } : {}));
const { data: notes, status } = useFetch<Note[]>('/api/notes', { query });
</script>

<template>
    <section>
        <h1>笔记搜索</h1>
        <input
            v-model="keyword"
            class="input search-input"
            type="search"
            placeholder="搜索标题或摘要，如：Nuxt"
        />
        <p v-if="status === 'pending'">搜索中……</p>
        <template v-else>
            <p v-if="!notes?.length" class="empty-tip">没有找到相关笔记</p>
            <div v-else class="grid">
                <NoteCard v-for="note in notes" :key="note.id" :note="note" />
            </div>
        </template>
    </section>
</template>

<style scoped>
.search-input {
    margin: 12px 0 20px;
}

.empty-tip {
    color: var(--color-text-muted);
}
</style>
