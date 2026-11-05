<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const TARGET = 0.999;
const TOTAL_REQUESTS = 1_000_000;
const WINDOW_MINUTES = 30 * 24 * 60;

const errorRatePct = ref(0.05);

const budgetFailures = Math.round(TOTAL_REQUESTS * (1 - TARGET));
const allowedDowntime = WINDOW_MINUTES * (1 - TARGET);

const actualFailures = computed(() => Math.round((TOTAL_REQUESTS * errorRatePct.value) / 100));
const consumedPct = computed(() => (actualFailures.value / budgetFailures) * 100);
const remainingFailures = computed(() => Math.max(0, budgetFailures - actualFailures.value));
const burnedDowntime = computed(() => allowedDowntime * (consumedPct.value / 100));
const availability = computed(() => (100 - errorRatePct.value).toFixed(3));
const barWidth = computed(() => Math.min(100, consumedPct.value));

const level = computed(() => {
    const consumed = consumedPct.value;
    if (consumed < 50) {
        return {
            key: 'ok',
            label: '正常',
            note: '错误预算充足，可以正常发版与做实验。',
            action: '保持 15 分钟粒度的观察，无需额外动作。',
        };
    }
    if (consumed < 80) {
        return {
            key: 'warn',
            label: '预警',
            note: '预算消耗偏快，需要关注错误率趋势。',
            action: '检查最近发布与依赖变更，准备回滚预案。',
        };
    }
    if (consumed < 100) {
        return {
            key: 'danger',
            label: '严重',
            note: '预算接近耗尽，新增风险已经很小。',
            action: '冻结非必要发布，优先修复稳定性问题。',
        };
    }
    return {
        key: 'critical',
        label: '预算耗尽',
        note: '已超出 99.9% 的承诺，用户可感知故障。',
        action: '立即止损：回滚、降级、限流，并对外同步进展。',
    };
});

const DEFINITIONS = [
    {
        term: 'SLI',
        full: 'Service Level Indicator',
        desc: '可测量的服务质量指标，例如成功率、P95 延迟、数据新鲜度。',
        example: '成功请求数 / 总请求数',
    },
    {
        term: 'SLO',
        full: 'Service Level Objective',
        desc: '给 SLI 设定的内部目标，是工程团队对自己的承诺。',
        example: '30 天可用性 ≥ 99.9%',
    },
    {
        term: 'SLA',
        full: 'Service Level Agreement',
        desc: '对客户的合同承诺，通常带赔偿条款，应严于 SLO 留出缓冲。',
        example: '可用性 ≥ 99.5%，否则赔付',
    },
    {
        term: '错误预算',
        full: 'Error Budget',
        desc: 'SLO 允许的失败总量，是团队可以主动消耗的“风险额度”。',
        example: '每 100 万请求允许 1,000 次失败',
    },
];

const LEVELS = [
    { range: '0% – 50%', name: '正常', color: 'accent', action: '正常发布；按周复盘趋势。' },
    { range: '50% – 80%', name: '预警', color: 'warn', action: '提高观察频率，检查最近变更。' },
    { range: '80% – 100%', name: '严重', color: 'danger', action: '冻结非必要发布，准备回滚。' },
    { range: '> 100%', name: '耗尽', color: 'critical', action: '立即止损并启动事故流程。' },
];

const BUDGET_CODE = `// 30 天窗口，可用性目标 99.9%
const TARGET = 0.999;
const WINDOW_MINUTES = 30 * 24 * 60;              // 43,200
const TOTAL_REQUESTS = 1_000_000;

const allowedDowntime = WINDOW_MINUTES * (1 - TARGET); // 43.2 分钟
const budgetFailures = TOTAL_REQUESTS * (1 - TARGET);  // 1,000 次

const actualFailures = TOTAL_REQUESTS * (errorRate / 100);
const consumed = actualFailures / budgetFailures;      // 0.5 = 已用一半
const remaining = Math.max(0, budgetFailures - actualFailures);`;

const LEVEL_CODE = `function alertLevel(consumed: number) {
    if (consumed < 0.5) return '正常';
    if (consumed < 0.8) return '预警';
    if (consumed < 1) return '严重';
    return '耗尽';
}

// 告警应绑定预算消耗速率，而不只是瞬时错误率
// 例如：1 小时内消耗了 20% 的 30 天预算 → 立即告警`;

const PITFALLS = [
    'SLO 不是越高越好。99.99% 意味着每月只有 4.3 分钟停机，成本会指数级上升。',
    '错误预算按“时间窗口”滚动计算，窗口选择要匹配业务：月度结算系统适合 30 天，直播适合 1 天。',
    '只统计 5xx 会把“成功但极慢”漏掉；延迟 SLO 要单独定义，不能混进可用性。',
    '预算耗尽后必须真的停止发布，否则错误预算只是墙上的装饰。',
    'SLO 需要随业务阶段调整：新业务先定 99.5%，稳定后再逐步收紧。',
];
</script>

<template>
    <DocPage
        title="SLO 运营面板"
        description="SLO 把技术指标翻译成业务承诺：目标定多少、允许失败多少次、什么时候必须停下来修稳定性。本页用 99.9% / 30 天窗口演示错误预算的实时消耗与告警分级。"
        :tags="['SLI', 'SLO', 'SLA', '错误预算', '告警分级', 'Runbook']"
    >
        <DocSection id="definitions" title="SLI / SLO / SLA 与错误预算" kicker="01 · DEFINITIONS">
            <p class="body-text">
                四个概念经常被混用。记住一条主线：SLI 是<strong>测量</strong>，
                SLO 是<strong>目标</strong>，SLA 是<strong>合同</strong>，
                错误预算是目标允许你<strong>失败的总量</strong>。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>术语</th><th>全称</th><th>含义</th><th>本页示例</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in DEFINITIONS" :key="row.term">
                            <td class="mono term">{{ row.term }}</td>
                            <td>{{ row.full }}</td>
                            <td>{{ row.desc }}</td>
                            <td class="mono">{{ row.example }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="BUDGET_CODE" lang="ts" title="错误预算的核心计算" />
        </DocSection>

        <DocSection id="calculator" title="错误预算计算器" kicker="02 · LIVE">
            <p class="body-text">
                假设 30 天窗口内共有 100 万次请求，可用性目标 99.9%，
                则错误预算为 1,000 次失败，折合允许停机 43.2 分钟。
                拖动滑块改变实际错误率，观察预算消耗与告警级别如何变化。
            </p>
            <DemoCard
                title="99.9% / 30 天 · 错误预算"
                desc="滑块调整 30 天窗口内的请求错误率（0% – 2%），预算按比例消耗。"
                badge="LIVE"
            >
                <div class="slider-row">
                    <label for="error-rate" class="slider-label">实际错误率</label>
                    <input
                        id="error-rate"
                        v-model.number="errorRatePct"
                        class="slider"
                        type="range"
                        min="0"
                        max="2"
                        step="0.01"
                        aria-describedby="error-rate-value"
                    >
                    <output id="error-rate-value" class="slider-value mono">
                        {{ errorRatePct.toFixed(2) }}%
                    </output>
                </div>
                <div class="slider-scale mono">
                    <span>0%</span>
                    <span>0.1% · 预算临界</span>
                    <span>2%</span>
                </div>

                <div class="budget-bar" role="img" :aria-label="`错误预算已消耗 ${consumedPct.toFixed(1)}%`">
                    <span
                        class="budget-fill"
                        :class="`budget-fill--${level.key}`"
                        :style="{ width: barWidth + '%' }"
                    />
                    <span class="budget-threshold budget-threshold--50" />
                    <span class="budget-threshold budget-threshold--80" />
                </div>
                <div class="budget-meta mono">
                    <span>{{ barWidth.toFixed(1) }}% consumed</span>
                    <span>{{ actualFailures.toLocaleString('zh-CN') }} / {{ budgetFailures.toLocaleString('zh-CN') }} failures</span>
                </div>

                <dl class="stat-grid">
                    <div class="stat">
                        <dt>实测可用性</dt>
                        <dd class="mono">{{ availability }}%</dd>
                    </div>
                    <div class="stat">
                        <dt>剩余失败额度</dt>
                        <dd class="mono">{{ remainingFailures.toLocaleString('zh-CN') }} 次</dd>
                    </div>
                    <div class="stat">
                        <dt>已消耗停机时间</dt>
                        <dd class="mono">{{ burnedDowntime.toFixed(1) }} / {{ allowedDowntime.toFixed(1) }} 分钟</dd>
                    </div>
                    <div class="stat">
                        <dt>错误预算消耗</dt>
                        <dd class="mono">{{ consumedPct.toFixed(1) }}%</dd>
                    </div>
                </dl>

                <div class="level-banner" :class="`level-banner--${level.key}`">
                    <span
                        class="badge"
                        :class="level.key === 'ok' ? 'badge--accent' : level.key === 'warn' ? 'badge--warn' : 'badge--danger'"
                    >
                        {{ level.label }}
                    </span>
                    <div>
                        <p class="level-note">{{ level.note }}</p>
                        <p class="level-action">行动：{{ level.action }}</p>
                    </div>
                </div>

                <template #footer>
                    错误率 0.1% 时预算刚好耗尽；低于 0.1% 仍有余额，高于 0.1% 即超出承诺。
                </template>
            </DemoCard>
        </DocSection>

        <DocSection id="alerting" title="告警分级与行动手册" kicker="03 · ALERTING">
            <p class="body-text">
                告警要绑定预算消耗速率，而不是单纯看瞬时错误率。
                瞬时 1% 的错误率持续 10 秒可能无关紧要，持续 1 小时就足以烧掉大半个月度预算。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>预算消耗</th><th>级别</th><th>团队动作</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in LEVELS" :key="row.range">
                            <td class="mono">{{ row.range }}</td>
                            <td>
                                <span class="badge" :class="`badge--${row.color === 'critical' ? 'danger' : row.color}`">
                                    {{ row.name }}
                                </span>
                            </td>
                            <td>{{ row.action }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="LEVEL_CODE" lang="ts" title="按预算消耗分级" />
            <Callout type="tip" title="预算是一种决策工具">
                健康的团队用错误预算决定“继续发版还是先修稳定性”，
                而不是在事故后争论“这次到底是前端还是后端的问题”。
            </Callout>
        </DocSection>

        <DocSection id="pitfalls" title="常见误区" kicker="04 · PITFALLS">
            <ul class="checklist">
                <li v-for="item in PITFALLS" :key="item">{{ item }}</li>
            </ul>
        </DocSection>
    </DocPage>
</template>

<style scoped>
.body-text {
    margin: 0 0 12px;
    font-size: 14px;
    line-height: 1.8;
    color: var(--text-muted);
}

.body-text strong {
    color: var(--text);
    font-weight: 600;
}

.term {
    color: var(--accent);
    font-weight: 600;
}

.slider-row {
    display: flex;
    align-items: center;
    gap: 14px;
}

.slider-label {
    flex-shrink: 0;
    font-size: 13px;
    color: var(--text-muted);
}

.slider {
    flex: 1;
    accent-color: var(--accent);
    cursor: pointer;
}

.slider-value {
    min-width: 62px;
    text-align: right;
    font-size: 15px;
    font-weight: 600;
    color: var(--accent);
}

.slider-scale {
    display: flex;
    justify-content: space-between;
    margin: 6px 0 16px;
    font-size: 10px;
    color: var(--text-faint);
}

.budget-bar {
    position: relative;
    height: 14px;
    overflow: hidden;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    background: var(--surface-2);
}

.budget-fill {
    display: block;
    height: 100%;
    border-radius: 999px;
    transition: width 200ms ease, background 200ms ease;
}

.budget-fill--ok {
    background: linear-gradient(90deg, var(--accent), var(--accent-strong));
}

.budget-fill--warn {
    background: linear-gradient(90deg, var(--accent), var(--warn));
}

.budget-fill--danger {
    background: linear-gradient(90deg, var(--warn), var(--danger));
}

.budget-fill--critical {
    background: linear-gradient(90deg, var(--danger), #b91c1c);
}

.budget-threshold {
    position: absolute;
    top: 0;
    width: 1px;
    height: 100%;
    background: var(--text-faint);
    opacity: 0.5;
}

.budget-threshold--50 {
    left: 50%;
}

.budget-threshold--80 {
    left: 80%;
}

.budget-meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px;
    margin: 8px 0 16px;
    font-size: 11px;
    color: var(--text-faint);
}

.stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    margin: 0;
}

.stat {
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
}

.stat dt {
    font-size: 11px;
    color: var(--text-faint);
}

.stat dd {
    margin: 6px 0 0;
    font-size: 15px;
    color: var(--accent);
}

.level-banner {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-top: 16px;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-left-width: 3px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
}

.level-banner--ok {
    border-left-color: var(--accent);
}

.level-banner--warn {
    border-left-color: var(--warn);
}

.level-banner--danger {
    border-left-color: var(--danger);
}

.level-banner--critical {
    border-left-color: #b91c1c;
}

.level-note {
    margin: 0;
    font-size: 13px;
    color: var(--text);
}

.level-action {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-muted);
}

.checklist {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.checklist li {
    position: relative;
    padding-left: 26px;
    font-size: 14px;
    line-height: 1.7;
    color: var(--text-muted);
}

.checklist li::before {
    content: '!';
    position: absolute;
    left: 0;
    top: 0;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: rgba(251, 191, 36, 0.15);
    color: var(--warn);
    font-family: var(--font-mono);
    font-size: 11px;
}
</style>
