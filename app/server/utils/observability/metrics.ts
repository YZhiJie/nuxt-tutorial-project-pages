/**
 * 进程内指标注册表：RED 指标（Rate / Errors / Duration）+ gauge。
 *
 * 只依赖 Node 进程内存，重启即清零，适合演示与单实例小站。
 * 生产应换成 prom-client（多实例聚合）或 OpenTelemetry SDK。
 */

type Labels = Record<string, string>;

interface Series {
    name: string;
    labels: Labels;
    value: number;
}

interface HistogramSeries {
    labels: Labels;
    /** 与 DURATION_BUCKETS_MS 一一对应的累计计数（已按 <= 桶上界统计） */
    buckets: number[];
    sum: number;
    count: number;
}

/** 耗时直方图桶上界（毫秒），与 Prometheus 的 le 标签一致 */
const DURATION_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000] as const;

const counters = new Map<string, Series>();
const gauges = new Map<string, Series>();
const histograms = new Map<string, HistogramSeries>();

const COUNTER_HELP: Record<string, string> = {
    nuxt_http_requests_total: 'Nitro 处理的 HTTP 请求总数。',
    nuxt_http_errors_total: 'Nitro 返回 5xx 的 HTTP 请求总数。',
};

const GAUGE_HELP: Record<string, string> = {
    nuxt_http_in_flight_requests: '当前正在处理中的 HTTP 请求数。',
};

const HISTOGRAM_HELP: Record<string, string> = {
    nuxt_http_request_duration_ms: 'HTTP 请求耗时分布（毫秒）。',
};

function seriesKey(name: string, labels: Labels): string {
    const pairs = Object.keys(labels)
        .sort()
        .map((key) => `${key}=${labels[key]}`)
        .join(',');
    return `${name}{${pairs}}`;
}

function escapeLabel(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function formatLabels(labels: Labels): string {
    const pairs = Object.entries(labels).map(([key, value]) => `${key}="${escapeLabel(value)}"`);
    return pairs.length ? `{${pairs.join(',')}}` : '';
}

function sortedSeries(source: Map<string, Series>, name: string): Series[] {
    return [...source.values()]
        .filter((series) => series.name === name)
        .sort((a, b) => seriesKey(name, a.labels).localeCompare(seriesKey(name, b.labels)));
}

/** 计数器自增，默认 +1 */
export function incCounter(name: string, labels: Labels = {}, value = 1): void {
    const key = seriesKey(name, labels);
    const current = counters.get(key);
    if (current) {
        current.value += value;
        return;
    }
    counters.set(key, { name, labels: { ...labels }, value });
}

/** 设置 gauge 当前值 */
export function setGauge(name: string, labels: Labels, value: number): void {
    gauges.set(seriesKey(name, labels), { name, labels: { ...labels }, value });
}

/** gauge 增减，用于并发数一类的瞬时指标 */
export function incGauge(name: string, labels: Labels, delta: number): void {
    const key = seriesKey(name, labels);
    const current = gauges.get(key);
    if (current) {
        current.value += delta;
        return;
    }
    gauges.set(key, { name, labels: { ...labels }, value: delta });
}

/** 写入一次直方图观测值 */
export function observeHistogram(name: string, labels: Labels, value: number): void {
    const key = seriesKey(name, labels);
    let series = histograms.get(key);
    if (!series) {
        series = {
            labels: { ...labels },
            buckets: DURATION_BUCKETS_MS.map(() => 0),
            sum: 0,
            count: 0,
        };
        histograms.set(key, series);
    }

    DURATION_BUCKETS_MS.forEach((upperBound, index) => {
        if (value <= upperBound) series.buckets[index] = (series.buckets[index] ?? 0) + 1;
    });
    series.sum += value;
    series.count += 1;
}

export interface HttpObservation {
    method: string;
    route: string;
    status: number;
    durationMs: number;
}

/**
 * 记录一次 HTTP 请求：请求数、5xx 错误数与耗时直方图。
 * 在响应 finish 后调用，确保拿到最终状态码。
 */
export function recordHttpRequest(observation: HttpObservation): void {
    const { method, route, status, durationMs } = observation;
    const baseLabels = { method, route };

    incCounter('nuxt_http_requests_total', { ...baseLabels, status: String(status) });

    if (status >= 500) {
        incCounter('nuxt_http_errors_total', { ...baseLabels, status: String(status) });
    }

    observeHistogram('nuxt_http_request_duration_ms', baseLabels, durationMs);
}

/** 渲染 Prometheus 文本格式（text/plain; version=0.0.4） */
export function renderPrometheusMetrics(): string {
    const lines: string[] = [];

    for (const name of new Set([...counters.values()].map((series) => series.name))) {
        lines.push(`# HELP ${name} ${COUNTER_HELP[name] ?? '计数器。'}`);
        lines.push(`# TYPE ${name} counter`);
        for (const series of sortedSeries(counters, name)) {
            lines.push(`${name}${formatLabels(series.labels)} ${series.value}`);
        }
    }

    for (const name of new Set([...gauges.values()].map((series) => series.name))) {
        lines.push(`# HELP ${name} ${GAUGE_HELP[name] ?? '瞬时值。'}`);
        lines.push(`# TYPE ${name} gauge`);
        for (const series of sortedSeries(gauges, name)) {
            lines.push(`${name}${formatLabels(series.labels)} ${series.value}`);
        }
    }

    const histogramName = 'nuxt_http_request_duration_ms';
    if (histograms.size) {
        lines.push(`# HELP ${histogramName} ${HISTOGRAM_HELP[histogramName]}`);
        lines.push(`# TYPE ${histogramName} histogram`);

        const sorted = [...histograms.entries()].sort(([a], [b]) => a.localeCompare(b));
        for (const [, series] of sorted) {
            DURATION_BUCKETS_MS.forEach((upperBound, index) => {
                const labels = { ...series.labels, le: String(upperBound) };
                lines.push(
                    `${histogramName}_bucket${formatLabels(labels)} ${series.buckets[index]}`,
                );
            });

            const infinityLabels = { ...series.labels, le: '+Inf' };
            lines.push(`${histogramName}_bucket${formatLabels(infinityLabels)} ${series.count}`);
            lines.push(`${histogramName}_sum${formatLabels(series.labels)} ${Number(series.sum.toFixed(3))}`);
            lines.push(`${histogramName}_count${formatLabels(series.labels)} ${series.count}`);
        }
    }

    return `${lines.join('\n')}\n`;
}
