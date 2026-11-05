<script setup lang="ts">
const props = withDefaults(
    defineProps<{
        density?: number;
        label?: string;
    }>(),
    { density: 6, label: '重型数据面板' },
);

const metrics = computed(() =>
    [
        { key: 'render', name: '渲染耗时', unit: 'ms', base: 18 },
        { key: 'hydrate', name: '水合节点', unit: '个', base: 240 },
        { key: 'memory', name: '内存占用', unit: 'MB', base: 12 },
        { key: 'bundle', name: '分包体积', unit: 'KB', base: 48 },
    ].map((metric, index) => ({
        ...metric,
        value: metric.base + props.density * (index + 2),
        ratio: Math.min(100, 30 + props.density * (index + 3)),
    })),
);

const mountedAt = ref('');

onMounted(() => {
    mountedAt.value = new Date().toLocaleTimeString('zh-CN');
});
</script>

<template>
    <section class="heavy-panel" aria-live="polite">
        <header class="heavy-head">
            <div>
                <p class="heavy-kicker">CHUNK · DEMO-HEAVY-PANEL</p>
                <h3 class="heavy-title">{{ label }}</h3>
            </div>
            <span class="heavy-badge">按需加载</span>
        </header>

        <div class="heavy-metrics">
            <div v-for="metric in metrics" :key="metric.key" class="metric-card">
                <p class="metric-name">{{ metric.name }}</p>
                <p class="metric-value">
                    {{ metric.value }}
                    <span class="metric-unit">{{ metric.unit }}</span>
                </p>
                <div class="metric-bar" role="presentation">
                    <span class="metric-bar-fill" :style="{ width: `${metric.ratio}%` }" />
                </div>
            </div>
        </div>

        <div class="heavy-grid">
            <div v-for="row in 3" :key="row" class="heavy-row">
                <span class="heavy-row-label mono">row-{{ row }}</span>
                <span
                    v-for="cell in 8"
                    :key="cell"
                    class="heavy-cell"
                    :style="{ opacity: 0.35 + ((row * cell + props.density) % 6) / 10 }"
                />
            </div>
        </div>

        <footer class="heavy-foot">
            <span>组件挂载时间：{{ mountedAt || '等待客户端挂载……' }}</span>
            <span class="heavy-density mono">density = {{ density }}</span>
        </footer>
    </section>
</template>

<style scoped>
.heavy-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    background:
        radial-gradient(1200px 300px at 0% 0%, var(--accent-soft), transparent 60%),
        var(--surface);
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.18);
    animation: heavy-in 240ms ease;
}

.heavy-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
}

.heavy-kicker {
    margin: 0 0 4px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.16em;
    color: var(--text-faint);
}

.heavy-title {
    margin: 0;
    font-size: 18px;
}

.heavy-badge {
    padding: 4px 10px;
    border: 1px solid var(--accent);
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 10px;
    white-space: nowrap;
}

.heavy-metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
}

.metric-card {
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
}

.metric-name {
    margin: 0;
    font-size: 11px;
    color: var(--text-faint);
}

.metric-value {
    margin: 4px 0 8px;
    font-family: var(--font-mono);
    font-size: 22px;
    font-weight: 700;
    color: var(--accent);
}

.metric-unit {
    font-size: 11px;
    font-weight: 400;
    color: var(--text-muted);
}

.metric-bar {
    height: 5px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--surface-2);
}

.metric-bar-fill {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--accent), var(--info));
    transition: width 260ms ease;
}

.heavy-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.heavy-row {
    display: flex;
    align-items: center;
    gap: 6px;
}

.heavy-row-label {
    width: 58px;
    flex-shrink: 0;
    font-size: 10px;
    color: var(--text-faint);
}

.heavy-cell {
    flex: 1;
    height: 18px;
    border-radius: 4px;
    background: var(--accent);
    transition: opacity 200ms ease;
}

.heavy-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    font-size: 11px;
    color: var(--text-muted);
}

.heavy-density {
    color: var(--accent);
}

@keyframes heavy-in {
    from {
        opacity: 0;
        transform: translateY(8px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@media (prefers-reduced-motion: reduce) {
    .heavy-panel,
    .metric-bar-fill,
    .heavy-cell {
        animation: none;
        transition: none;
    }
}
</style>
