<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const PLAYWRIGHT_CODE = `// e2e/order-flow.spec.ts —— 只测关键路径
import { test, expect } from '@playwright/test';

test('订单从草稿推进到关闭', async ({ page }) => {
    await page.goto('/fullstack/enterprise');

    await page.getByRole('button', { name: '创建订单' }).click();
    const row = page.getByRole('listitem').filter({ hasText: '增量订阅订单' }).first();

    await row.getByRole('button', { name: '支付' }).click();
    await row.getByRole('button', { name: '发货' }).click();
    await row.getByRole('button', { name: '关闭' }).click();

    await expect(row.getByText('closed')).toBeVisible();
});`;

const CONFIG_CODE = `// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 4 : undefined,
    reporter: [['html', { open: 'never' }], ['github']],
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
    },
});`;

const VISUAL_CODE = `// 截图基线：首次运行生成，之后逐像素比对
await expect(page).toHaveScreenshot('enterprise.png', {
    fullPage: true,
    // 时间、随机 id 等动态内容必须遮罩，否则每次都不一致
    mask: [page.locator('[data-dynamic="time"]'), page.locator('.log-row')],
    maxDiffPixelRatio: 0.01,
});

// 更新基线：只在确认设计变更后执行，并纳入代码评审
// npx playwright test --update-snapshots`;

const CI_CODE = `# .github/workflows/e2e.yml（节选）
jobs:
  e2e:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm exec playwright test --shard=\${{ matrix.shard }}/4
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report-\${{ matrix.shard }}
          path: playwright-report/`;

const paths = [
    { path: '首页 → 模块 → 文档页', why: '导航与预取失效会直接阻断全部内容消费' },
    { path: '登录 → 受保护页面', why: '会话、中间件与跳转是最高频回归点' },
    { path: '表单校验与提交', why: '双层校验、错误反馈、重复提交' },
    { path: '订单状态机推进', why: '写路径 + 409 + 幂等，业务价值最高' },
    { path: '搜索与空结果', why: '输入、防抖、空态与错误态' },
];

const selectors = [
    { rank: '1', strategy: 'getByRole', example: 'getByRole("button", { name: "支付" })', why: '语义 + 可访问名，最稳定，也顺带验证无障碍' },
    { rank: '2', strategy: 'getByLabel', example: 'getByLabel("订单标题")', why: '表单控件首选，替代 input[name]' },
    { rank: '3', strategy: 'getByText', example: 'getByText("已发货")', why: '用户可见文案，文案变更即需求变更' },
    { rank: '4', strategy: 'getByTestId', example: 'getByTestId("order-row")', why: '无稳定语义时的兜底，需约定命名' },
    { rank: '5', strategy: 'CSS / XPath', example: '.order-row:nth-child(2)', why: '最脆弱，结构一改就碎，避免使用' },
];

const flakyRules = [
    '禁止 waitForTimeout：改用 expect(locator).toBeVisible() 等自动重试断言。',
    '测试数据自造自清：唯一标题前缀 + afterEach 清理，避免相互依赖。',
    '每个测试独立登录与独立上下文：不共享 storageState 之外的可变状态。',
    '失败必须留证据：trace on-first-retry、video 与截图只在上传产物中保留。',
    '重试不是修复：连续两周 flaky 的用例要么修根因，要么删除并记录原因。',
    'CI 并行分片后总时长下降，但资源竞争会放大抖动；先稳定再扩分片。',
];
</script>

<template>
    <DocPage
        title="E2E 与视觉回归"
        description="E2E 用真实浏览器验证用户路径，视觉回归用截图基线守住设计。它们最接近真实，也最脆弱——所以只覆盖关键路径，并严格治理抖动。"
        :tags="['Playwright', '选择器', '截图基线', 'CI 分片', 'flaky']"
    >
        <DocSection id="paths" title="关键路径清单" kicker="01 · CRITICAL PATH">
            <p class="body-text">
                E2E 的预算有限，只应覆盖“坏了会导致业务不可用”的路径。
                页面越多，维护成本与抖动概率越高；能用组件测试覆盖的交互，不要放进 E2E。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>路径</th><th>为什么必须覆盖</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in paths" :key="row.path">
                            <td>{{ row.path }}</td>
                            <td>{{ row.why }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="PLAYWRIGHT_CODE" lang="ts" title="一条关键路径" />
        </DocSection>

        <DocSection id="selectors" title="选择器策略" kicker="02 · SELECTOR">
            <p class="body-text">
                选择器的稳定性取决于它依赖什么：语义与可访问名最稳定，
                DOM 结构与样式类名最脆弱。优先使用 Playwright 的语义定位器，
                它们同时也在验证页面的无障碍质量。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>优先级</th><th>方式</th><th>示例</th><th>说明</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in selectors" :key="row.rank">
                            <td class="mono">{{ row.rank }}</td>
                            <td class="mono">{{ row.strategy }}</td>
                            <td class="mono">{{ row.example }}</td>
                            <td>{{ row.why }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <Callout type="tip" title="定位器即无障碍检查">
                当按钮只有图标、没有可访问名时，<code>getByRole</code> 会失败——
                这恰好暴露了真实用户（读屏）也会遇到的问题。
            </Callout>
        </DocSection>

        <DocSection id="visual" title="截图基线与视觉回归" kicker="03 · VISUAL">
            <p class="body-text">
                视觉回归比较的是渲染结果，不是 DOM。它擅长发现布局塌陷、
                主题变量失效与意外的样式回归；但对动态内容极其敏感，
                必须遮罩时间、随机 id、动画中的元素，并设置合理的像素容差。
            </p>
            <CodeBlock :code="VISUAL_CODE" lang="ts" title="toHaveScreenshot" />
            <Callout type="warn" title="基线也是代码">
                截图文件必须进版本库并经过评审。更新基线时在 PR 中说明“为什么视觉变了”，
                否则它迟早变成“全部更新一下”的习惯动作。
            </Callout>
        </DocSection>

        <DocSection id="ci" title="CI 并行与配置" kicker="04 · CI">
            <p class="body-text">
                Playwright 的 <code>webServer</code> 负责拉起服务，CI 用分片并行缩短总时长。
                失败时上传 trace 与报告，让本地复现不需要“再跑一遍看看”。
            </p>
            <CodeBlock :code="CONFIG_CODE" lang="ts" title="playwright.config.ts" />
            <CodeBlock :code="CI_CODE" lang="yaml" title="分片与产物上传" />
        </DocSection>

        <DocSection id="flaky" title="flaky 治理" kicker="05 · FLAKY">
            <ul class="checklist">
                <li v-for="item in flakyRules" :key="item">{{ item }}</li>
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
