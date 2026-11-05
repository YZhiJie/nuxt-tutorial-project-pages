<script setup lang="ts">
import { summarizeNotes } from '#shared/utils/notes-stats';
import type { Note } from '#shared/types/note';

definePageMeta({ layout: 'docs' });

const baseNotes: Note[] = [
    {
        id: 1,
        title: 'Nuxt 4 快速上手',
        excerpt: '',
        content: '',
        tags: ['nuxt', 'ssr'],
        createdAt: '2026-10-01T09:00:00.000Z',
    },
    {
        id: 2,
        title: 'useFetch 与服务端渲染',
        excerpt: '',
        content: '',
        tags: ['nuxt', 'pinia'],
        createdAt: '2026-10-10T09:00:00.000Z',
    },
];

const withExtra = ref(false);
const input = computed<Note[]>(() =>
    withExtra.value
        ? [
              ...baseNotes,
              {
                  id: 3,
                  title: '重复标签用例',
                  excerpt: '',
                  content: '',
                  tags: ['nuxt', 'nuxt'],
                  createdAt: '2026-09-01T09:00:00.000Z',
              },
          ]
        : baseNotes,
);

const stats = computed(() => summarizeNotes(input.value));
const statsJson = computed(() => JSON.stringify(stats.value, null, 2));

const SOURCE_CODE = `// shared/utils/notes-stats.ts —— 纯函数，无 IO、无框架依赖
import type { Note } from '#shared/types/note';
import type { AdminStats } from '#shared/types/admin';

export function summarizeNotes(notes: Note[]): AdminStats {
    const tags = new Set(notes.flatMap((note) => note.tags));
    const latestNoteAt = notes.reduce<string | null>(
        (latest, note) => (!latest || note.createdAt > latest ? note.createdAt : latest),
        null,
    );

    return {
        totalNotes: notes.length,
        totalTags: tags.size,
        latestNoteAt,
    };
}`;

const TEST_CODE = `// tests/notes-stats.test.ts —— 与 vitest.config.ts 的 include 对齐
import { describe, expect, it } from 'vitest';
import { summarizeNotes } from '../shared/utils/notes-stats';
import type { Note } from '../shared/types/note';

const notes: Note[] = [
    { id: 1, tags: ['nuxt', 'ssr'], createdAt: '2026-10-01T09:00:00.000Z', /* ... */ },
    { id: 2, tags: ['nuxt', 'pinia'], createdAt: '2026-10-10T09:00:00.000Z', /* ... */ },
];

describe('summarizeNotes', () => {
    it('汇总笔记数量与最新创建时间', () => {
        expect(summarizeNotes(notes)).toEqual({
            totalNotes: 2,
            totalTags: 3,
            latestNoteAt: '2026-10-10T09:00:00.000Z',
        });
    });

    it('标签跨笔记去重', () => {
        const result = summarizeNotes([
            { ...notes[0]!, tags: ['nuxt', 'nuxt'] },
            { ...notes[1]!, tags: ['nuxt', 'testing'] },
        ]);
        expect(result.totalTags).toBe(2);
    });

    it('空列表返回零值与 null', () => {
        expect(summarizeNotes([])).toEqual({
            totalNotes: 0,
            totalTags: 0,
            latestNoteAt: null,
        });
    });
});`;

const COMMANDS = `# 在 app/ 目录下
npm run test            # vitest run：跑一次即退出，适合 CI
npm run test -- --reporter=verbose
npx vitest run tests/notes-stats.test.ts   # 只跑单个文件

# 监听模式（本地开发）
npx vitest`;

const testPoints = [
    { case: '正常列表', input: '2 条笔记，共 3 个不同标签', expect: 'totalNotes=2，totalTags=3，latestNoteAt 取最新' },
    { case: '标签去重', input: '同一标签在两条笔记中重复出现', expect: 'totalTags 只计 1 次' },
    { case: '空列表', input: '[]', expect: '0 / 0 / null，不抛错' },
    { case: '纯函数', input: '传入数组后再次读取', expect: '入参数组长度与顺序不变' },
];
</script>

<template>
    <DocPage
        title="单元测试"
        description="单元测试的对象是纯函数：输入确定、输出确定、没有网络与时间依赖。本页用仓库里真实的 notes-stats 工具函数，写出可执行、可维护的断言。"
        :tags="['Vitest', '纯函数', '异常分支', 'describe / it / expect']"
    >
        <DocSection id="target" title="被测对象：一个纯函数" kicker="01 · TARGET">
            <p class="body-text">
                <code>summarizeNotes</code> 把笔记列表压缩成后台概览：
                总数、去重后的标签数、最新创建时间。它没有 IO、没有时间依赖，
                所以测试不需要 mock，也不需要启动 Nuxt。
            </p>
            <CodeBlock :code="SOURCE_CODE" lang="ts" title="shared/utils/notes-stats.ts" />
            <Callout type="info" title="纯函数优先">
                把可计算的逻辑从组件与 handler 中抽出来，测试成本会下降一个数量级。
                组件只负责取值与展示，错误自然更少。
            </Callout>
        </DocSection>

        <DocSection id="test" title="测试点与断言" kicker="02 · ASSERT">
            <p class="body-text">
                好的测试点来自输入空间的分区：正常值、边界值、空值、重复值。
                每个测试只验证一个行为，断言要具体到字段，而不是只断言“返回了对象”。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>用例</th><th>输入</th><th>期望</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in testPoints" :key="row.case">
                            <td>{{ row.case }}</td>
                            <td>{{ row.input }}</td>
                            <td>{{ row.expect }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="TEST_CODE" lang="ts" title="tests/notes-stats.test.ts" />
        </DocSection>

        <DocSection id="run" title="运行与命令" kicker="03 · RUN">
            <p class="body-text">
                测试文件放在 <code>tests/</code> 下，由 <code>vitest.config.ts</code> 的
                <code>include: ['tests/**/*.test.ts']</code> 收集。
                文件名必须匹配 <code>*.test.ts</code>，否则不会被执行。
            </p>
            <CodeBlock :code="COMMANDS" lang="bash" title="运行命令" />
        </DocSection>

        <DocSection id="demo" title="实时观察汇总结果" kicker="04 · LIVE">
            <p class="body-text">
                下面直接调用同一个 <code>summarizeNotes</code>。
                打开「追加重复标签笔记」后，标签总数不会从 3 变成 4——这正是
                <code>Set</code> 去重行为，也是测试里断言的点。
            </p>
            <DemoCard
                title="summarizeNotes 实时预览"
                desc="切换输入，观察 totalNotes / totalTags / latestNoteAt 的变化。"
                badge="LIVE"
            >
                <label class="switch-row">
                    <input v-model="withExtra" type="checkbox" />
                    <span>追加一条重复标签的笔记（tags: nuxt, nuxt）</span>
                </label>

                <div class="stats-grid">
                    <div class="stat">
                        <p class="stat-name">totalNotes</p>
                        <p class="stat-value mono">{{ stats.totalNotes }}</p>
                    </div>
                    <div class="stat">
                        <p class="stat-name">totalTags</p>
                        <p class="stat-value mono">{{ stats.totalTags }}</p>
                    </div>
                    <div class="stat">
                        <p class="stat-name">latestNoteAt</p>
                        <p class="stat-value mono stat-value--time">{{ stats.latestNoteAt ?? 'null' }}</p>
                    </div>
                </div>

                <pre class="json-view">{{ statsJson }}</pre>
            </DemoCard>
        </DocSection>

        <DocSection id="pitfalls" title="常见误区" kicker="05 · PITFALLS">
            <ul class="checklist">
                <li>断言实现而不是行为：例如断言内部用了 Set，重构后测试误报。</li>
                <li>一个 it 里塞多个场景：失败时无法判断是哪条规则坏了。</li>
                <li>忽略 null 分支：<code>latestNoteAt</code> 的空列表返回值同样需要覆盖。</li>
                <li>测试文件命名不符合 include：本地能跑、CI 收集不到。</li>
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

.switch-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-muted);
    cursor: pointer;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 10px;
    margin-top: 14px;
}

.stat {
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
}

.stat-name {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-faint);
}

.stat-value {
    margin: 4px 0 0;
    font-size: 20px;
    font-weight: 700;
    color: var(--accent);
}

.stat-value--time {
    font-size: 12px;
    font-weight: 400;
    word-break: break-all;
}

.json-view {
    margin-top: 14px;
    font-size: 12px;
    background: var(--bg-elevated);
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
</style>
