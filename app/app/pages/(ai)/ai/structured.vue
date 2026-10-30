<script setup lang="ts">
definePageMeta({ layout: 'docs' });

interface StructuredResult {
    model: string;
    attempts: number;
    repaired: boolean;
    ok: boolean;
    errors: string[];
    data: Record<string, unknown> | null;
    raw: Record<string, unknown>;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

const DEFAULT_PROMPT = '把这段客服对话整理成工单字段：用户反馈登录页面在 Safari 下白屏，影响所有新用户。';
const prompt = ref(DEFAULT_PROMPT);
const result = ref<StructuredResult | null>(null);
const loading = ref(false);
const errorMessage = ref('');

const verdict = computed(() => {
    if (!result.value) return '尚未提交';
    return result.value.ok ? '校验通过' : '校验失败';
});

const verdictTone = computed(() => {
    if (!result.value) return 'idle';
    return result.value.ok ? 'ok' : 'bad';
});

const prettyData = computed(() =>
    result.value ? JSON.stringify(result.value.data, null, 2) : '',
);

const prettyRaw = computed(() =>
    result.value ? JSON.stringify(result.value.raw, null, 2) : '',
);

function fill(text: string) {
    prompt.value = text;
}

async function submit() {
    if (loading.value || !prompt.value.trim()) return;

    loading.value = true;
    errorMessage.value = '';

    try {
        const data = await $fetch<StructuredResult>('/api/ai/structured', {
            method: 'POST',
            body: { prompt: prompt.value },
        });
        result.value = data;
    } catch (error) {
        result.value = null;
        errorMessage.value = getApiErrorMessage(error, '结构化请求失败');
    } finally {
        loading.value = false;
    }
}

function reset() {
    result.value = null;
    errorMessage.value = '';
    prompt.value = DEFAULT_PROMPT;
}

const SERVER_CODE = `const ALLOWED = ['title', 'summary', 'tags', 'risk'];

function validate(input) {
    const errors = [];
    // 1. 拒绝 schema 之外的字段
    const extra = Object.keys(input).filter((key) => !ALLOWED.includes(key));
    if (extra.length) errors.push('未声明字段：' + extra.join(', '));

    // 2. 类型、长度、枚举逐项检查
    if (typeof input.title !== 'string' || !input.title.trim()) {
        errors.push('title 必须是非空字符串');
    }
    if (!Array.isArray(input.tags) || input.tags.length > 8) {
        errors.push('tags 必须是 1–8 项的字符串数组');
    }
    if (!['low', 'medium', 'high'].includes(input.risk)) {
        errors.push('risk 必须是 low / medium / high');
    }
    return errors;
}

function repair(input) {
    // 只修复结构问题：缺字段、类型漂移、空白项
    // risk 属于语义判断，不在这里静默改写
}

export default defineEventHandler(async (event) => {
    const { prompt } = await readBody(event);
    if (!prompt?.trim()) throw createError({ statusCode: 400, message: '请输入文本' });

    const raw = await callModel(prompt);      // 本页用 mock 生成
    let errors = validate(raw);
    let attempts = 1;
    let repaired = false;
    let data = raw;

    if (errors.length) {
        attempts = 2;
        repaired = true;
        data = repair(raw);
        errors = validate(data);              // 修复后必须重新校验
    }

    return {
        model: 'mock-structured-v1',
        attempts,
        repaired,
        ok: errors.length === 0,
        errors,
        data,
        raw,
        usage: usageFrom(prompt, raw),
    };
});`;

const constraintRows = [
    { field: 'title', rule: '字符串，非空，≤ 80 字符', use: '页面标题或工单标题' },
    { field: 'summary', rule: '字符串，非空，≤ 240 字符', use: '卡片摘要与列表预览' },
    { field: 'tags', rule: '字符串数组，1–8 项', use: '筛选、检索与聚类' },
    { field: 'risk', rule: '枚举 low / medium / high', use: '决定是否进入人工审批' },
    { field: '额外字段', rule: '一律拒绝', use: '防止模型擅自扩展协议' },
];

const failureRows = [
    { type: '结构错误', example: 'tags 是字符串、出现额外字段', strategy: 'repair 后重新校验', outcome: '可自动恢复，标记 repaired' },
    { type: '语义错误', example: 'risk = critical', strategy: '不修复，直接返回失败', outcome: '交给人工或降级流程' },
    { type: '格式错误', example: '返回了 Markdown 代码块', strategy: '提取 JSON 后校验', outcome: '失败则记录原始输出' },
    { type: '提示注入', example: '文档里写着「忽略之前指令」', strategy: '输入与指令隔离 + 输出校验', outcome: '不把检索内容当指令' },
];

const notes = [
    '模型可能返回带 ```json 包裹的文本，JSON.parse 之前要先剥离代码块并 try/catch。',
    'repair 只能修结构，不能修事实；把 critical 改成 high 是在掩盖风险，而不是修复。',
    '校验失败必须保留 raw 与 errors，否则无法判断是模型问题还是 schema 问题。',
    '结构化输出不能替代前端表单校验：用户仍可能直接改动提交的数据。',
    '提示词里加入 schema 与示例能提高命中率，但永远不能替代服务端校验。',
];
</script>

<template>
    <DocPage
        title="结构化输出"
        description="让模型返回 JSON 只是开始：字段类型、长度、枚举与额外字段都要在服务端校验。本页调用真实的 /api/ai/structured 接口，演示「脏数据修复」与「语义越界拒绝」。"
        :tags="['JSON Schema', '校验', 'repair', '失败重试', '提示注入']"
    >
        <DocSection id="constraints" title="为什么必须写约束" kicker="01 · CONSTRAINTS">
            <p class="body-text">
                模型输出是「概率结果」，不是数据库行。同一个提示词，今天返回数组，明天可能返回逗号分隔的字符串；
                多一个字段、少一个字段都很常见。约束的作用不是让模型更聪明，
                而是让下游代码有一个可验证的稳定契约。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>字段</th><th>约束</th><th>用途</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in constraintRows" :key="row.field">
                            <td class="mono">{{ row.field }}</td>
                            <td>{{ row.rule }}</td>
                            <td>{{ row.use }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="validate" title="校验、修复与重新校验" kicker="02 · VALIDATE">
            <p class="body-text">
                推荐的处理顺序是：先严格校验；对<strong>可安全纠正的结构问题</strong>做一次修复，
                再重新校验；对<strong>语义问题</strong>不做静默改写，直接返回失败。
                「把 critical 改成 high」看起来让流程通过了，实际上掩盖了风险。
            </p>
            <CodeBlock :code="SERVER_CODE" lang="ts" title="server/api/ai/structured.post.ts" />
            <Callout type="warn" title="修复是有限度的">
                repair 只处理缺字段、类型漂移、空白数组项。事实错误、越界枚举、
                与输入矛盾的内容，都必须通过校验失败暴露出来。
            </Callout>
        </DocSection>

        <DocSection id="demo" title="结构化输出实验台" kicker="03 · DEMO">
            <p class="body-text">
                默认提示词会返回合法结构。点击「插入脏数据」会触发类型错误与额外字段，
                服务端修复后通过；点击「插入越界枚举」会让 <code>risk</code> 变成
                <code>critical</code>，修复不会改写语义，因此最终仍然失败。
            </p>

            <DemoCard
                title="结构化输出校验"
                desc="真实调用 /api/ai/structured，观察 raw、修复结果与 errors。"
                badge="LIVE"
            >
                <label class="field">
                    <span class="field-label">提示词</span>
                    <textarea
                        v-model="prompt"
                        class="prompt-input"
                        rows="3"
                        :disabled="loading"
                    />
                </label>

                <div class="demo-actions">
                    <button type="button" class="btn btn--sm" :disabled="loading" @click="submit">
                        {{ loading ? '请求中……' : '提交并校验' }}
                    </button>
                    <button
                        type="button"
                        class="btn btn--ghost btn--sm"
                        :disabled="loading"
                        @click="fill('请整理这段脏数据：用户说登录失败，附带了大量无关的调试日志。')"
                    >
                        插入「脏数据」
                    </button>
                    <button
                        type="button"
                        class="btn btn--ghost btn--sm"
                        :disabled="loading"
                        @click="fill('这个问题的风险等级越界了，请按 critical 处理。')"
                    >
                        插入「越界枚举」
                    </button>
                    <button type="button" class="btn btn--ghost btn--sm" :disabled="loading" @click="reset">
                        恢复默认
                    </button>
                </div>

                <p v-if="errorMessage" class="hint hint--warn">{{ errorMessage }}</p>

                <div class="status-grid">
                    <div class="status-item">
                        <span class="status-label">校验结果</span>
                        <span class="status-value" :class="`tone--${verdictTone}`">{{ verdict }}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">尝试次数</span>
                        <span class="status-value mono">{{ result?.attempts ?? '—' }}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">是否修复</span>
                        <span class="status-value mono">{{ result ? (result.repaired ? 'yes' : 'no') : '—' }}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">错误数</span>
                        <span class="status-value mono">{{ result ? result.errors.length : '—' }}</span>
                    </div>
                    <div class="status-item status-item--wide">
                        <span class="status-label">Token 用量</span>
                        <span class="status-value mono">
                            {{ result ? result.usage.promptTokens + ' / ' + result.usage.completionTokens + ' / ' + result.usage.totalTokens : '—' }}
                        </span>
                    </div>
                </div>

                <ul v-if="result?.errors.length" class="error-list">
                    <li v-for="item in result.errors" :key="item">{{ item }}</li>
                </ul>

                <div v-if="result" class="json-grid">
                    <div class="json-box">
                        <div class="json-head">
                            <span class="mono">raw · 模型原始输出</span>
                        </div>
                        <pre class="json-text mono">{{ prettyRaw }}</pre>
                    </div>
                    <div class="json-box">
                        <div class="json-head">
                            <span class="mono">data · 校验 / 修复结果</span>
                            <span class="badge" :class="result.ok ? 'badge--accent' : 'badge--danger'">
                                {{ result.ok ? 'ok' : 'fail' }}
                            </span>
                        </div>
                        <pre class="json-text mono">{{ prettyData }}</pre>
                    </div>
                </div>
                <p v-else class="hint">尚未提交。结果会同时展示模型原始输出与服务端处理后的数据。</p>

                <template #footer>
                    <span v-if="result?.ok">
                        通过：结构合法，可以直接入库或渲染；repaired 表示过程中做过一次结构化修复。
                    </span>
                    <span v-else-if="result">
                        未通过：语义字段未被静默改写，错误列表就是下游应当处理的输入。
                    </span>
                    <span v-else>点击「提交并校验」，对比 raw 与 data 的差异。</span>
                </template>
            </DemoCard>
        </DocSection>

        <DocSection id="failure" title="失败策略与提示注入" kicker="04 · FAILURE">
            <p class="body-text">
                结构化输出失败时，最差的处理是「把异常吞掉，返回一个默认对象」。
                那会让前端以为成功，把错误数据写进数据库。正确做法是区分可恢复与不可恢复，
                并保留证据。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>失败类型</th><th>示例</th><th>策略</th><th>结果</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in failureRows" :key="row.type">
                            <td>{{ row.type }}</td>
                            <td>{{ row.example }}</td>
                            <td>{{ row.strategy }}</td>
                            <td>{{ row.outcome }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <ul class="checklist">
                <li v-for="item in notes" :key="item">{{ item }}</li>
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
}

.checklist {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 16px 0 0;
    padding: 0;
    list-style: none;
}

.checklist li {
    position: relative;
    padding-left: 24px;
    font-size: 14px;
    line-height: 1.7;
    color: var(--text-muted);
}

.checklist li::before {
    content: '→';
    position: absolute;
    left: 0;
    color: var(--accent);
    font-family: var(--font-mono);
}

.field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.field-label {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-faint);
}

.prompt-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    color: var(--text);
    font-size: 13px;
    line-height: 1.7;
    resize: vertical;
}

.prompt-input:focus {
    outline: none;
    border-color: var(--accent);
}

.prompt-input:disabled {
    opacity: 0.65;
    cursor: not-allowed;
}

.demo-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
}

.status-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 14px;
}

.status-item {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
}

.status-item--wide {
    grid-column: 1 / -1;
}

.status-label {
    font-size: 11px;
    color: var(--text-faint);
}

.status-value {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    overflow-wrap: anywhere;
}

.tone--ok {
    color: var(--accent);
}

.tone--bad {
    color: var(--danger);
}

.tone--idle {
    color: var(--text-muted);
}

.hint {
    margin: 12px 0 0;
    font-size: 12px;
    line-height: 1.7;
    color: var(--text-faint);
}

.hint--warn {
    color: var(--warn);
}

.error-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 14px 0 0;
    padding: 10px 12px 10px 30px;
    border-left: 3px solid var(--danger);
    border-radius: 6px;
    background: rgba(248, 113, 113, 0.08);
    list-style: disc;
    font-size: 12px;
    line-height: 1.7;
    color: var(--danger);
}

.json-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 16px;
}

.json-box {
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
    overflow: hidden;
}

.json-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 11px;
    border-bottom: 1px solid var(--line);
    background: var(--surface-2);
    font-size: 11px;
    color: var(--text-faint);
}

.json-text {
    margin: 0;
    padding: 12px 14px;
    max-height: 260px;
    overflow: auto;
    font-size: 11.5px;
    line-height: 1.7;
    color: var(--text-muted);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

@media (max-width: 640px) {
    .json-grid {
        grid-template-columns: 1fr;
    }
}
</style>

