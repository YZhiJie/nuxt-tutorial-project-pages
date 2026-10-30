<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const VITEST_CONFIG = `// vitest.config.ts —— 根目录配置，纯单测不依赖 Nuxt 运行时
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts'],
        environment: 'node',
    },
});`;

const SCRIPTS_CODE = `// app/package.json
"scripts": {
    "test": "vitest run",          // CI 一次跑完，非零退出即失败
    "test:watch": "vitest",        // 本地开发监听
    "typecheck": "nuxi typecheck"  // 类型检查与测试并列，不可互相替代
}`;

const COVERAGE_CODE = `// vitest.config.ts
test: {
    coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        include: ['shared/utils/**', 'app/utils/**'],
        thresholds: {
            lines: 80,
            functions: 80,
            branches: 70,
            statements: 80,
        },
    },
}

// 覆盖率只做下限，不做 KPI：禁止为了数字写没有断言的测试`;

const CI_CODE = `name: test
on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --dir app test
      - run: pnpm --dir app typecheck`;

const layers = [
    { name: '单元测试', target: '纯函数、工具、状态机', cost: '毫秒级，无 IO', feedback: '精确到函数与分支', ratio: '最多' },
    { name: '组件测试', target: 'props / emits / slots / 交互', cost: '百毫秒级', feedback: '定位到组件', ratio: '中等' },
    { name: '接口集成', target: 'handler、状态码、契约', cost: '需启动服务', feedback: '定位到接口', ratio: '少量' },
    { name: 'E2E / 视觉', target: '关键路径、跨页流程', cost: '分钟级，易抖动', feedback: '定位到流程', ratio: '最少' },
];

const antiPatterns = [
    '只测 happy path：错误分支、空数据、边界值恰恰最容易出事。',
    '断言实现细节：组件内部方法名、样式类名、私有状态，一改就红。',
    '用 sleep 等待异步：换成 await nextTick / waitFor / 轮询断言。',
    '测试之间共享可变状态：每个用例自己造数据、自己清理。',
    '把 E2E 当单元测试用：慢、脆、定位差，关键路径之外不写。',
    '覆盖率冲数字：没有断言的执行不计入有效覆盖。',
];
</script>

<template>
    <DocPage
        title="测试体系"
        description="测试不是越多越好，而是每一层只做它最擅长的事。金字塔决定成本结构，契约决定断言位置，CI 门禁决定它能否长期存活。"
        :tags="['测试金字塔', 'Vitest', '覆盖率', 'CI 门禁']"
    >
        <DocSection id="pyramid" title="测试金字塔" kicker="01 · PYRAMID">
            <p class="body-text">
                越靠下的测试越快、越稳定、越容易定位；越靠上的测试越接近真实用户，
                但成本与抖动也随之上升。合理的结构是底座厚、塔尖薄，
                而不是把信心全部押在 E2E。
            </p>
            <div class="pyramid" aria-hidden="true">
                <div class="pyramid-bar pyramid-bar--e2e">E2E / 视觉回归</div>
                <div class="pyramid-bar pyramid-bar--api">接口集成</div>
                <div class="pyramid-bar pyramid-bar--component">组件测试</div>
                <div class="pyramid-bar pyramid-bar--unit">单元测试（纯函数）</div>
            </div>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>层</th><th>测什么</th><th>成本</th><th>失败定位</th><th>数量</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in layers" :key="row.name">
                            <td>{{ row.name }}</td>
                            <td>{{ row.target }}</td>
                            <td>{{ row.cost }}</td>
                            <td>{{ row.feedback }}</td>
                            <td>{{ row.ratio }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="tooling" title="Vitest：从纯函数开始" kicker="02 · VITEST">
            <p class="body-text">
                项目当前只启用纯单测：<code>shared/utils/</code>、<code>app/utils/</code>
                这类不依赖 Nuxt 运行时的函数。它们不需要启动服务、不需要浏览器，
                因此在 CI 中最稳定，也最适合作为第一道门禁。
            </p>
            <CodeBlock :code="VITEST_CONFIG" lang="ts" title="vitest.config.ts" />
            <CodeBlock :code="SCRIPTS_CODE" lang="json" title="常用脚本" />
            <Callout type="tip" title="测试与类型检查并行">
                <code>vitest</code> 只验证运行时行为，<code>nuxi typecheck</code> 只验证类型。
                两者都过，才说明代码既“能跑”又“契约正确”。
            </Callout>
        </DocSection>

        <DocSection id="coverage" title="覆盖率与门禁" kicker="03 · COVERAGE">
            <p class="body-text">
                覆盖率的价值是发现“从未被执行的分支”，而不是证明质量。
                把它设成下限（例如 80% 行覆盖），低于阈值让 CI 失败；
                同时明确排除页面与生成代码，避免用无关文件稀释数字。
            </p>
            <CodeBlock :code="COVERAGE_CODE" lang="ts" title="覆盖率阈值" />
            <Callout type="warn" title="provider 需要额外依赖">
                覆盖率使用 <code>@vitest/coverage-v8</code>，本仓库尚未安装；
                引入覆盖率前需单独添加该 devDependency，本页不修改依赖。
            </Callout>
            <CodeBlock :code="CI_CODE" lang="yaml" title="GitHub Actions 门禁" />
        </DocSection>

        <DocSection id="antipattern" title="反模式" kicker="04 · ANTI-PATTERN">
            <ul class="checklist">
                <li v-for="item in antiPatterns" :key="item">{{ item }}</li>
            </ul>
            <p class="body-text next">
                下一节把理论落到本仓库：用 <code>shared/utils/notes-stats.ts</code>
                写出第一组真正可执行的断言。
                <NuxtLink to="/testing/unit" class="inline-link">继续阅读「单元测试」→</NuxtLink>
            </p>
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

.pyramid {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin: 4px 0 18px;
}

.pyramid-bar {
    padding: 8px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
}

.pyramid-bar--e2e {
    width: 38%;
    border-color: rgba(251, 191, 36, 0.4);
    color: var(--warn);
}

.pyramid-bar--api {
    width: 56%;
    border-color: rgba(34, 211, 238, 0.4);
    color: var(--info);
}

.pyramid-bar--component {
    width: 74%;
}

.pyramid-bar--unit {
    width: 92%;
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
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
    color: var(--text-muted);
    line-height: 1.7;
}

.checklist li::before {
    content: '×';
    position: absolute;
    left: 0;
    top: 0;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: rgba(248, 113, 113, 0.15);
    color: var(--danger);
    font-family: var(--font-mono);
    font-size: 11px;
}

.next {
    margin-top: 16px;
}

.inline-link {
    color: var(--accent);
    border-bottom: 1px dashed var(--accent);
}
</style>
