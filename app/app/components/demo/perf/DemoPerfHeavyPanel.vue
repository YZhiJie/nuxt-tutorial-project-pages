<script setup lang="ts">
/**
 * 性能演示用的“重组件”：节点多、样式多，用来观察懒加载前后
 * 网络请求、DOM 数量与挂载耗时。文件名带 Perf 前缀避免与已有 DemoHeavyPanel 重名。
 */
const props = withDefaults(
    defineProps<{
        rows?: number;
        label?: string;
    }>(),
    { rows: 12, label: '重型分析面板' },
);

const cells = computed(() =>
    Array.from({ length: props.rows }, (_, row) => ({
        id: row,
        values: Array.from(
            { length: 10 },
            (_, col) => Math.round(20 + ((row * 17 + col * 23) % 75)),
        ),
    })),
);

const mountedAt = ref('');
const mountedMs = ref<number | null>(null);

const summary = computed(() => [
    { name: 'DOM 节点', value: props.rows * 12 + 40, unit: '个' },
    { name: '样式规则', value: 46, unit: '条' },
    { name: '挂载耗时', value: mountedMs.value ?? '—', unit: 'ms' },
]);

onMounted(() => {
    const startedAt = performance.now();
    mountedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    requestAnimationFrame(() => {
        mountedMs.value = Number((performance.now() - startedAt).toFixed(1));
    });
});
</script>

<template>
    <section class="perf-heavy" aria-label="按需加载的重型面板">
        <header class="perf-heavy__head">
            <div>
                <p class="perf-heavy__kicker mono">CHUNK · DEMO-PERF-HEAVY-PANEL</p>
                <h3 class="perf-heavy__title">{{ label }}</h3>
            </div>
            <span class="perf-heavy__badge">lazy chunk</span>
        </header>

        <div class="perf-heavy__summary">
            <div v-for="item in summary" :key="item.name" class="perf-heavy__stat">
                <p class="perf-heavy__stat-name">{{ item.name }}</p>
                <p class="perf-heavy__stat-value">
                    {{ item.value }}
                    <span>{{ item.unit }}</span>
                </p>
            </div>
        </div>

        <div class="perf-heavy__table" role="table" :aria-rowcount="rows + 1">
            <div class="perf-heavy__row perf-heavy__row--head" role="row">
                <span role="columnheader">row</span>
                <span v-for="col in 10" :key="col" role="columnheader">c{{ col }}</span>
            </div>
            <div v-for="row in cells" :key="row.id" class="perf-heavy__row" role="row">
                <span class="perf-heavy__row-label mono" role="rowheader">r{{ row.id + 1 }}</span>
                <span
                    v-for="(value, index) in row.values"
                    :key="index"
                    class="perf-heavy__cell"
                    :style="{ opacity: 0.25 + value / 140 }"
                    role="cell"
                >
                    {{ value }}
                </span>
            </div>
        </div>

        <footer class="perf-heavy__foot">
            <span>客户端挂载于 {{ mountedAt || '等待水合……' }}</span>
            <span class="mono">rows = {{ rows }}</span>
        </footer>
    </section>
</template>

<style scoped>
.perf-heavy {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    background:
        radial-gradient(900px 240px at 0% 0%, var(--accent-soft), transparent 60%),
        var(--surface);
    box-shadow: var(--shadow-soft);
    animation: perf-heavy-in 240ms ease;
}

.perf-heavy__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
}

.perf-heavy__kicker {
    margin: 0 0 4px;
    font-size: 10px;
    letter-spacing: 0.14em;
    color: var(--text-faint);
}

.perf-heavy__title {
    margin: 0;
    font-size: 18px;
}

.perf-heavy__badge {
    padding: 4px 10px;
    border: 1px solid var(--accent);
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 10px;
    white-space: nowrap;
}

.perf-heavy__summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 12px;
}

.perf-heavy__stat {
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
}

.perf-heavy__stat-name {
    margin: 0;
    font-size: 11px;
    color: var(--text-faint);
}

.perf-heavy__stat-value {
    margin: 4px 0 0;
    font-family: var(--font-mono);
    font-size: 22px;
    font-weight: 700;
    color: var(--accent);
}

.perf-heavy__stat-value span {
    font-size: 11px;
    font-weight: 400;
    color: var(--text-muted);
}

.perf-heavy__table {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
}

.perf-heavy__row {
    display: grid;
    grid-template-columns: 46px repeat(10, minmax(0, 1fr));
    gap: 4px;
}

.perf-heavy__row--head {
    padding-bottom: 6px;
    border-bottom: 1px solid var(--line);
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-faint);
}

.perf-heavy__row-label {
    display: flex;
    align-items: center;
    font-size: 10px;
    color: var(--text-faint);
}

.perf-heavy__cell {
    display: grid;
    place-items: center;
    height: 24px;
    border-radius: 4px;
    background: linear-gradient(180deg, var(--accent), var(--accent-strong));
    color: #04130c;
    font-family: var(--font-mono);
    font-size: 10px;
    transition: opacity 180ms ease;
}

.perf-heavy__foot {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    font-size: 11px;
    color: var(--text-muted);
}

@keyframes perf-heavy-in {
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
    .perf-heavy,
    .perf-heavy__cell {
        animation: none;
        transition: none;
    }
}
</style>
