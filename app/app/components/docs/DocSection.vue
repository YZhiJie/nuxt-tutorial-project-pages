<script setup lang="ts">
defineProps<{
    title: string;
    id?: string;
    kicker?: string;
    desc?: string;
}>();
</script>

<template>
    <section :id="id" class="doc-section">
        <p v-if="kicker" class="eyebrow">{{ kicker }}</p>
        <h2 class="section-title">
            {{ title }}
            <a v-if="id" :href="`#${id}`" class="anchor" :aria-label="`锚点：${title}`">#</a>
        </h2>
        <p v-if="desc" class="section-desc">{{ desc }}</p>
        <slot />
    </section>
</template>

<style scoped>
.doc-section {
    scroll-margin-top: calc(var(--header-h) + 18px);
}

.section-title {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0 0 10px;
    font-size: 23px;
    line-height: 1.35;
    letter-spacing: -0.01em;
}

.anchor {
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: 14px;
    opacity: 0;
    transition: opacity 140ms ease, color 140ms ease;
}

.section-title:hover .anchor {
    opacity: 1;
    color: var(--accent);
}

.section-desc {
    margin: 0 0 14px;
    color: var(--text-muted);
    font-size: 14px;
}
</style>
