<script setup lang="ts">
// 路由切换时在内容区显示骨架屏，状态由 04.route-loading 插件维护
const isLoading = useState('route-loading', () => false);
</script>

<template>
    <Transition name="content-loading">
        <div v-if="isLoading" class="content-loading" role="status" aria-live="polite" aria-busy="true">
            <div class="loading-head">
                <span class="loading-spinner" aria-hidden="true" />
                <span class="loading-label mono">加载中</span>
            </div>
            <div class="loading-skeleton" aria-hidden="true">
                <span class="skeleton-line skeleton-line--eyebrow" />
                <span class="skeleton-line skeleton-line--title" />
                <span class="skeleton-line" />
                <span class="skeleton-line skeleton-line--short" />
            </div>
        </div>
    </Transition>
</template>

<style scoped>
.content-loading {
    position: absolute;
    inset: 0;
    z-index: 20;
    padding: 34px 0 0;
    background: color-mix(in srgb, var(--bg) 82%, transparent);
    backdrop-filter: blur(6px);
    pointer-events: none;
}

.loading-head {
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 860px;
}

.loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--accent-soft);
    border-top-color: var(--accent);
    border-radius: 999px;
    animation: content-loading-spin 0.7s linear infinite;
}

.loading-label {
    font-size: 11px;
    letter-spacing: 0.14em;
    color: var(--accent);
}

.loading-skeleton {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 720px;
    margin-top: 22px;
}

.skeleton-line {
    display: block;
    width: 100%;
    height: 12px;
    border-radius: 6px;
    background: linear-gradient(90deg, var(--surface-2), var(--surface), var(--surface-2));
    background-size: 200% 100%;
    animation: content-loading-shimmer 1.2s linear infinite;
}

.skeleton-line--eyebrow {
    width: 120px;
    height: 10px;
}

.skeleton-line--title {
    width: 62%;
    height: 26px;
    margin: 6px 0 10px;
}

.skeleton-line--short {
    width: 42%;
}

.content-loading-enter-active,
.content-loading-leave-active {
    transition: opacity 180ms ease;
}

.content-loading-enter-from,
.content-loading-leave-to {
    opacity: 0;
}

@keyframes content-loading-spin {
    to {
        transform: rotate(360deg);
    }
}

@keyframes content-loading-shimmer {
    from {
        background-position: 200% 0;
    }
    to {
        background-position: -200% 0;
    }
}

@media (prefers-reduced-motion: reduce) {
    .loading-spinner,
    .skeleton-line {
        animation: none;
    }
}
</style>
