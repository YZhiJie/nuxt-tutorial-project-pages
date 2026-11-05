<script setup lang="ts">
withDefaults(
    defineProps<{
        type?: 'info' | 'tip' | 'warn' | 'danger';
        title?: string;
    }>(),
    { type: 'info' },
);

const marks = {
    info: 'i',
    tip: '✓',
    warn: '!',
    danger: '×',
} as const;
</script>

<template>
    <div class="callout" :class="`callout--${type}`">
        <span class="callout-mark" aria-hidden="true">{{ marks[type] }}</span>
        <div class="callout-body">
            <p v-if="title" class="callout-title">{{ title }}</p>
            <slot />
        </div>
    </div>
</template>

<style scoped>
.callout {
    display: flex;
    gap: 12px;
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-left-width: 3px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    font-size: 14px;
    line-height: 1.7;
}

.callout-mark {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    margin-top: 2px;
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
}

.callout-body :deep(p) {
    margin: 0;
}

.callout-body :deep(p + p) {
    margin-top: 8px;
}

.callout-title {
    font-weight: 600;
    margin-bottom: 2px !important;
}

.callout--info {
    border-color: rgba(34, 211, 238, 0.2);
    border-left-color: var(--info);
    background: rgba(34, 211, 238, 0.06);
    color: var(--info);
}

.callout--info .callout-mark {
    background: rgba(34, 211, 238, 0.16);
    color: var(--info);
}

.callout--tip {
    border-left-color: var(--accent);
}

.callout--tip .callout-mark {
    background: var(--accent-soft);
    color: var(--accent);
}

.callout--warn {
    border-left-color: var(--warn);
}

.callout--warn .callout-mark {
    background: rgba(251, 191, 36, 0.15);
    color: var(--warn);
}

.callout--danger {
    border-left-color: var(--danger);
}

.callout--danger .callout-mark {
    background: rgba(248, 113, 113, 0.15);
    color: var(--danger);
}
</style>
