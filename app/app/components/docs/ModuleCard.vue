<script setup lang="ts">
import type { Module } from '#shared/knowledge/modules';

defineProps<{
    module: Module;
    index: number;
}>();
</script>

<template>
    <NuxtLink :to="`/${module.key}`" class="module-card">
        <div class="card-top">
            <span class="module-mark">{{ module.mark }}</span>
            <span class="module-index mono">{{ String(index + 1).padStart(2, '0') }}</span>
        </div>
        <h3>{{ module.title }}</h3>
        <p class="module-brief">{{ module.brief }}</p>
        <p class="module-goal">{{ module.goal }}</p>
        <div class="card-bottom">
            <span class="badge">{{ module.demos.length }} 个页面</span>
            <span class="arrow" aria-hidden="true">→</span>
        </div>
    </NuxtLink>
</template>

<style scoped>
.module-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 18px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    transition: border-color 160ms ease, transform 160ms ease, background 160ms ease;
}

.module-card:hover {
    border-color: var(--accent);
    background: var(--surface-2);
    transform: translateY(-3px);
}

.card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.module-mark {
    display: grid;
    place-items: center;
    min-width: 34px;
    height: 24px;
    padding: 0 6px;
    border-radius: 6px;
    background: var(--accent-soft);
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
}

.module-index {
    font-size: 11px;
    color: var(--text-faint);
}

h3 {
    margin: 4px 0 0;
    font-size: 17px;
    letter-spacing: -0.01em;
}

.module-brief {
    margin: 0;
    font-size: 13px;
    color: var(--text-muted);
}

.module-goal {
    margin: 0;
    font-size: 12px;
    color: var(--text-faint);
    line-height: 1.55;
}

.card-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: auto;
    padding-top: 10px;
}

.arrow {
    color: var(--accent);
    font-size: 16px;
}
</style>
