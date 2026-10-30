<script setup lang="ts">
import type { FullstackItem } from '#shared/types/fullstack-item';

definePageMeta({ layout: 'docs' });

interface CheckResult {
    label: string;
    expected: number;
    actual: number;
    pass: boolean;
    detail: string;
}

const checks = ref<CheckResult[]>([]);
const running = ref(false);

function statusOf(error: unknown, fallback = -1): number {
    const e = error as { statusCode?: number; data?: { statusCode?: number } };
    return e.statusCode ?? e.data?.statusCode ?? fallback;
}

async function expectStatus(label: string, expected: number, run: () => Promise<string>) {
    let actual = 200;
    let detail = '';
    try {
        detail = await run();
    } catch (error) {
        actual = statusOf(error);
        detail = getApiErrorMessage(error);
    }
    checks.value = [
        ...checks.value,
        { label, expected, actual, pass: actual === expected, detail },
    ];
}

async function runChecks() {
    running.value = true;
    checks.value = [];

    await expectStatus('GET /api/fullstack/items', 200, async () => {
        const items = await $fetch<FullstackItem[]>('/api/fullstack/items');
        return `返回 ${items.length} 条`;
    });

    await expectStatus('POST 空标题', 400, async () => {
        await $fetch('/api/fullstack/items', { method: 'POST', body: { title: '   ' } });
        return '未抛出错误';
    });

    await expectStatus('DELETE /api/fullstack/items/999999', 404, async () => {
        await $fetch('/api/fullstack/items/999999', { method: 'DELETE' });
        return '未抛出错误';
    });

    running.value = false;
}

const VTU_CODE = `// tests/components/DemoProfileCard.test.ts（模板）
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DemoProfileCard from '../../app/components/demo/DemoProfileCard.vue';

describe('DemoProfileCard', () => {
    it('点击关注后 emit update:modelValue', async () => {
        const wrapper = mount(DemoProfileCard, {
            props: { name: '林一', modelValue: false },
        });
        await wrapper.get('button').trigger('click');
        expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true]);
    });

    it('已关注时文案与 aria-pressed 同步', () => {
        const wrapper = mount(DemoProfileCard, {
            props: { name: '林一', modelValue: true },
        });
        expect(wrapper.get('button').text()).toBe('已关注');
        expect(wrapper.get('button').attributes('aria-pressed')).toBe('true');
    });
});`;

const CONTRACT_CODE = `// tests/api/items.contract.test.ts
// 前置：先启动 Nuxt（npm run dev），再执行契约测试
const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

describe('items API 契约', () => {
    it('GET 返回数组', async () => {
        const res = await fetch(BASE + '/api/fullstack/items');
        expect(res.status).toBe(200);
        expect(Array.isArray(await res.json())).toBe(true);
    });

    it('POST 空标题返回 400 与可读错误', async () => {
        const res = await fetch(BASE + '/api/fullstack/items', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: '   ' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.message).toContain('标题');
    });
});`;

const TIMEOUT_CODE = `// 契约测试必须设置超时，否则 CI 会被挂起的请求拖死
it('GET 列表在 2s 内返回', async () => {
    const res = await fetch(BASE + '/api/fullstack/items', {
        signal: AbortSignal.timeout(2000),
    });
    expect(res.status).toBe(200);
});

// 超时与失败要区分：AbortError 说明服务不可用或过慢，
// 4xx / 5xx 说明服务在响应但契约不符`;

const strategy = [
    { layer: '组件', tool: 'Vue Test Utils + Vitest', focus: 'props / emits / slots / 键盘交互', avoid: '真实网络、真实路由' },
    { layer: '接口', tool: 'Vitest + fetch / $fetch', focus: '状态码、错误体、字段结构', avoid: '只断言 200、不测错误分支' },
    { layer: '页面', tool: 'Nuxt Test Utils（未安装）', focus: 'useFetch 同构、中间件、路由', avoid: '把 E2E 当页面测试' },
];
</script>

<template>
    <DocPage
        title="组件与接口测试"
        description="组件测试验证交互契约，接口测试验证 HTTP 契约。两者都不需要浏览器，却是 CI 中性价比最高的两层。"
        :tags="['Vue Test Utils', '契约测试', '状态码', '超时']"
    >
        <DocSection id="component" title="组件交互测试" kicker="01 · COMPONENT">
            <p class="body-text">
                组件测试挂载真实组件，断言「输入 → 输出」：props 改变渲染，
                点击触发 emit，插槽拿到正确的 props。
                不关心组件内部用了什么变量，只关心外部可见的行为。
            </p>
            <CodeBlock :code="VTU_CODE" lang="ts" title="mount + trigger + emitted" />
            <Callout type="warn" title="当前仓库未安装 @vue/test-utils">
                项目现有测试只依赖 Vitest。上面是引入组件测试后的模板，
                真正落地时需要新增 <code>@vue/test-utils</code> 与
                <code>happy-dom</code> 作为 devDependency，本页不修改依赖。
            </Callout>
        </DocSection>

        <DocSection id="contract" title="接口契约测试" kicker="02 · CONTRACT">
            <p class="body-text">
                接口测试不关心数据库里有什么，只关心 HTTP 层承诺了什么：
                状态码、响应结构、错误信息。它跑在真实 Nitro 进程上，
                因此能抓住 handler 注册、序列化与中间件问题。
            </p>
            <CodeBlock :code="CONTRACT_CODE" lang="ts" title="状态码与错误体断言" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>层</th><th>工具</th><th>关注点</th><th>不要做</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in strategy" :key="row.layer">
                            <td>{{ row.layer }}</td>
                            <td class="mono">{{ row.tool }}</td>
                            <td>{{ row.focus }}</td>
                            <td>{{ row.avoid }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="resilience" title="超时、数据隔离与清理" kicker="03 · RESILIENCE">
            <p class="body-text">
                CI 里最常见的事故不是断言失败，而是测试挂起。
                所有外部请求都要有超时；所有写测试都要造唯一数据并在结束后清理，
                否则重复运行会污染彼此。
            </p>
            <CodeBlock :code="TIMEOUT_CODE" lang="ts" title="超时与失败区分" />
            <Callout type="tip" title="测试数据命名">
                用 <code>test-${Date.now()}</code> 这类唯一前缀创建数据，并在
                <code>afterEach</code> 中删除。不要依赖“库里本来就有一条 id=1”。
            </Callout>
        </DocSection>

        <DocSection id="demo" title="契约自检" kicker="04 · LIVE">
            <p class="body-text">
                下面的按钮会真实调用本模块接口，并逐条比对期望状态码。
                契约测试的核心逻辑就是这三步：发请求、取状态码、断言相等。
            </p>
            <DemoCard
                title="接口契约自检"
                desc="期望：GET=200，空标题 POST=400，删除不存在资源 DELETE=404。"
                badge="API"
            >
                <button class="btn" type="button" :disabled="running" @click="runChecks">
                    {{ running ? '检测中……' : '运行契约检查' }}
                </button>

                <ul v-if="checks.length" class="check-list">
                    <li v-for="item in checks" :key="item.label" class="check-row">
                        <span class="check-state" :class="item.pass ? 'check-state--ok' : 'check-state--bad'">
                            {{ item.pass ? 'PASS' : 'FAIL' }}
                        </span>
                        <div class="check-main">
                            <p class="check-label mono">{{ item.label }}</p>
                            <p class="check-detail">
                                期望 {{ item.expected }} · 实际 {{ item.actual }} · {{ item.detail }}
                            </p>
                        </div>
                    </li>
                </ul>
                <p v-else class="empty">尚未运行。</p>
            </DemoCard>
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

.check-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 14px 0 0;
    padding: 0;
    list-style: none;
}

.check-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
}

.check-state {
    flex-shrink: 0;
    padding: 2px 7px;
    border-radius: 5px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
}

.check-state--ok {
    background: var(--accent-soft);
    color: var(--accent);
}

.check-state--bad {
    background: rgba(248, 113, 113, 0.15);
    color: var(--danger);
}

.check-label {
    margin: 0;
    font-size: 12px;
    color: var(--text);
}

.check-detail {
    margin: 2px 0 0;
    font-size: 11px;
    color: var(--text-muted);
    word-break: break-all;
}

.empty {
    margin: 14px 0 0;
    font-size: 12px;
    color: var(--text-faint);
}
</style>
