<script setup lang="ts">
withDefaults(
    defineProps<{
        title: string;
        desc?: string;
        badge?: string;
    }>(),
    { badge: 'LIVE' },
);
</script>

<template>
    <div class="demo-card">
        <div class="demo-head">
            <div>
                <p class="demo-title">{{ title }}</p>
                <p v-if="desc" class="demo-desc">{{ desc }}</p>
            </div>
            <span class="badge badge--accent">{{ badge }}</span>
        </div>
        <div class="demo-body">
            <slot />
        </div>
        <div v-if="$slots.footer" class="demo-footer">
            <slot name="footer" />
        </div>
    </div>
</template>

<style scoped>
.demo-card {
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background:
        linear-gradient(180deg, var(--accent-soft), transparent 120px),
        var(--surface);
    overflow: hidden;
}

.demo-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 14px;
    padding: 16px 18px 12px;
    border-bottom: 1px solid var(--line);
}

.demo-title {
    margin: 0;
    font-weight: 600;
    font-size: 15px;
}

.demo-desc {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--text-muted);
}

.demo-body {
    padding: 18px;
}

.demo-footer {
    padding: 12px 18px;
    border-top: 1px solid var(--line);
    background: var(--surface-2);
    font-size: 12px;
    color: var(--text-muted);
}
</style>
