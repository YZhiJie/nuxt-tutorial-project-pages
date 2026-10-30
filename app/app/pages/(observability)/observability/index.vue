<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const PILLARS = [
    {
        name: '日志 Logs',
        question: '发生了什么？',
        shape: '离散事件 + 上下文',
        example: 'requestId、用户、错误堆栈、耗时',
        cost: '写入量大，需要采样与保留策略',
    },
    {
        name: '指标 Metrics',
        question: '整体趋势如何？',
        shape: '可聚合的数值',
        example: '请求数、错误率、P50 / P95 / P99',
        cost: '标签基数可控时成本很低',
    },
    {
        name: '追踪 Traces',
        question: '时间花在哪一段？',
        shape: '跨服务调用链',
        example: '缓存命中、数据库、下游接口',
        cost: '链路存储成本高，通常按比例采样',
    },
];

const RED_CODE = `// server/middleware/observability.ts（节选）
const startedAt = performance.now();

event.node.res.on('finish', () => {
    const status = event.node.res.statusCode;
    const durationMs = performance.now() - startedAt;

    // Rate + Errors + Duration 一次采集完成
    recordHttpRequest({
        method: event.node.req.method ?? 'GET',
        route: getRequestURL(event).pathname,
        status,
        durationMs,
    });
});`;

const BUDGET_CODE = `// 30 天窗口，可用性目标 99.9%
const windowMinutes = 30 * 24 * 60;               // 43,200 分钟
const allowedDowntime = windowMinutes * 0.001;     // 43.2 分钟
const budgetFailures = totalRequests * 0.001;      // 每 100 万请求 1,000 次失败

const consumed = actualFailures / budgetFailures;  // < 1 表示预算仍充足
const level = consumed < 0.5 ? '正常' : consumed < 0.8 ? '预警' : consumed < 1 ? '严重' : '耗尽';`;

const SLO_ROWS = [
    {
        name: '可用性',
        sli: '成功请求数 / 总请求数',
        target: '99.9%',
        budget: '43.2 分钟 / 30 天',
        alert: '错误率连续 5 分钟 > 0.1%',
    },
    {
        name: '延迟',
        sli: 'P95 < 300ms 的请求占比',
        target: '95%',
        budget: '5% 的慢请求额度',
        alert: 'P95 连续 3 个窗口超阈值',
    },
    {
        name: '正确性',
        sli: '校验通过写入 / 总写入',
        target: '99.99%',
        budget: '每万次写入 1 次失败',
        alert: '出现数据不一致立即人工介入',
    },
];

const CLOSED_LOOP = [
    '日志必须带 requestId、用户标识与关键业务字段，避免“只有一行报错、无法复现”。',
    '指标标签只放低基数字段（method、status、route 模板），不要把用户 ID、原始 URL 放进去。',
    '告警绑定 SLO 与错误预算，而不是绑定 CPU、内存这类与用户无关的资源指标。',
    '每条告警都要有行动手册：谁处理、先看哪个面板、如何回滚、如何对外沟通。',
    '每起事故结束后补充观测点：缺少的日志、指标或追踪链路，比复盘文档更值钱。',
];
</script>

<template>
    <DocPage
        title="可观测性"
        description="可观测性不是“多打日志”，而是用日志、指标与追踪回答三个问题：发生了什么、整体是否健康、时间花在哪。再向上用 SLO 与错误预算把技术信号翻译成业务决策。"
        :tags="['Logs', 'Metrics', 'Traces', 'RED', 'SLO', '错误预算']"
    >
        <DocSection id="pillars" title="日志 / 指标 / 追踪三件套" kicker="01 · PILLARS">
            <p class="body-text">
                三种信号回答的问题不同，不能用其中一种替代另外两种。
                排查单次故障靠日志与追踪，判断“是否整体变慢 / 变差”靠指标，
                而指标异常时又要靠追踪定位到具体调用段。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>信号</th><th>回答的问题</th><th>数据形态</th><th>典型内容</th><th>主要成本</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="pillar in PILLARS" :key="pillar.name">
                            <td class="pillar-name">{{ pillar.name }}</td>
                            <td>{{ pillar.question }}</td>
                            <td>{{ pillar.shape }}</td>
                            <td>{{ pillar.example }}</td>
                            <td>{{ pillar.cost }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <Callout type="tip" title="先能关联，再谈丰富">
                三件套的第一要求不是“采集得多”，而是“能按同一次请求关联起来”。
                这就是本模块先讲 requestId，再讲指标与 SLO 的原因。
            </Callout>
        </DocSection>

        <DocSection id="red" title="RED：最省成本的黄金三指标" kicker="02 · RED">
            <p class="body-text">
                对每个对外服务，至少暴露三个指标：<strong>Rate</strong>（请求速率）、
                <strong>Errors</strong>（错误率）、<strong>Duration</strong>（耗时分布）。
                它们直接对应用户体验，也比 CPU、内存更能触发有意义的告警。
            </p>
            <CodeBlock :code="RED_CODE" lang="ts" title="一次请求同时产出 RED 指标" />
            <div class="grid grid--two">
                <div class="mini-card">
                    <h3>Rate · 请求量</h3>
                    <p>按 method / route / status 聚合。突增可能意味着攻击、重试风暴或前端轮询 bug。</p>
                </div>
                <div class="mini-card">
                    <h3>Errors · 错误率</h3>
                    <p>区分 4xx 与 5xx。4xx 是客户端问题，5xx 才进入错误预算；两者都要可见。</p>
                </div>
                <div class="mini-card">
                    <h3>Duration · 耗时</h3>
                    <p>用直方图而不是平均值。P95 / P99 才能暴露“少数用户极慢”的真实体验。</p>
                </div>
                <div class="mini-card">
                    <h3>标签纪律</h3>
                    <p>标签值必须可枚举：route 用模板而非原始 URL，避免指标基数爆炸。</p>
                </div>
            </div>
        </DocSection>

        <DocSection id="slo" title="SLO 与错误预算总览" kicker="03 · SLO">
            <p class="body-text">
                SLI 是可测量的服务质量指标，SLO 是给 SLI 定的目标，错误预算则是
                “目标允许你失败多少次”。把预算当成一种有限资源，团队才能在
                “继续发版”与“先修稳定性”之间做出一致决策。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>目标</th><th>SLI 定义</th><th>SLO</th><th>错误预算</th><th>告警条件</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in SLO_ROWS" :key="row.name">
                            <td class="pillar-name">{{ row.name }}</td>
                            <td>{{ row.sli }}</td>
                            <td class="mono">{{ row.target }}</td>
                            <td>{{ row.budget }}</td>
                            <td>{{ row.alert }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="BUDGET_CODE" lang="ts" title="错误预算消耗计算" />
            <p class="body-text">
                本模块的 <NuxtLink to="/observability/slo" class="inline-link">SLO 运营面板</NuxtLink>
                提供一个可拖动的错误率滑块，实时演示预算消耗与告警级别。
            </p>
        </DocSection>

        <DocSection id="loop" title="从信号到行动" kicker="04 · CLOSED LOOP">
            <p class="body-text">
                可观测性的终点不是仪表盘，而是更短的故障恢复时间。每个信号都应该有明确的
                使用场景与负责人，否则只是昂贵的装饰。
            </p>
            <ul class="checklist">
                <li v-for="item in CLOSED_LOOP" :key="item">{{ item }}</li>
            </ul>
            <div class="grid">
                <NuxtLink to="/observability/request-id" class="next-link">
                    <span class="mono">NEXT</span>
                    <span>请求上下文与日志</span>
                </NuxtLink>
                <NuxtLink to="/observability/metrics" class="next-link">
                    <span class="mono">API</span>
                    <span>Prometheus 指标</span>
                </NuxtLink>
                <NuxtLink to="/observability/slo" class="next-link">
                    <span class="mono">LIVE</span>
                    <span>SLO 运营面板</span>
                </NuxtLink>
            </div>
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

.pillar-name {
    font-weight: 600;
    color: var(--accent);
    white-space: nowrap;
}

.inline-link {
    color: var(--accent);
    border-bottom: 1px dashed var(--accent);
}

.mini-card {
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
}

.mini-card h3 {
    margin: 0 0 6px;
    font-size: 14px;
}

.mini-card p {
    margin: 0;
    font-size: 13px;
    line-height: 1.65;
    color: var(--text-muted);
}

.next-link {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface-2);
    font-size: 13px;
    color: var(--text-muted);
    transition: border-color 140ms ease, transform 140ms ease;
}

.next-link:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
}

.next-link .mono {
    color: var(--accent);
    font-size: 11px;
    letter-spacing: 0.08em;
}

.checklist {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0 0 18px;
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
    content: '✓';
    position: absolute;
    left: 0;
    top: 0;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 11px;
}
</style>
