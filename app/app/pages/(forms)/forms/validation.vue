<script setup lang="ts">
definePageMeta({ layout: 'docs' });

interface ErrorPayload {
    data?: { fields?: Record<string, string> };
    fields?: Record<string, string>;
}

interface ProfileForm {
    name: string;
    email: string;
    age: number | '';
}

const initial: ProfileForm = { name: '', email: '', age: 18 };
const form = reactive<ProfileForm>({ ...initial });
const touched = reactive({ name: false, email: false, age: false });
const submitted = ref(false);
const submitting = ref(false);
const serverErrors = ref<Record<string, string>>({});
const serverMessage = ref('');
const successProfile = ref<{ name: string; email: string; age: number } | null>(null);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 客户端即时校验：每次输入都会重新计算
const errors = computed(() => {
    const next: Record<string, string> = {};

    if (!form.name.trim()) {
        next.name = '姓名不能为空';
    } else if (form.name.trim().length < 2 || form.name.trim().length > 20) {
        next.name = '姓名长度需在 2–20 个字符之间';
    }

    if (!form.email.trim()) {
        next.email = '邮箱不能为空';
    } else if (!EMAIL_RE.test(form.email.trim())) {
        next.email = '邮箱格式不正确';
    }

    if (form.age === '' || !Number.isInteger(Number(form.age))) {
        next.age = '年龄必须是整数';
    } else if (Number(form.age) < 18 || Number(form.age) > 120) {
        next.age = '年龄需在 18–120 之间';
    }

    return next;
});

const hasClientError = computed(() => Object.keys(errors.value).length > 0);

// 失焦或尝试提交后才展示错误，避免打扰输入
function showError(field: keyof typeof touched): string {
    if (!touched[field] && !submitted.value) return '';
    return errors.value[field] ?? '';
}

function serverError(field: string): string {
    return serverErrors.value[field] ?? '';
}

async function onSubmit() {
    submitted.value = true;
    serverErrors.value = {};
    serverMessage.value = '';
    successProfile.value = null;

    if (hasClientError.value) return;

    submitting.value = true;
    try {
        const payload = await $fetch<{
            ok: boolean;
            profile: { name: string; email: string; age: number };
        }>('/api/forms/validate', {
            method: 'POST',
            body: {
                name: form.name,
                email: form.email,
                age: Number(form.age),
            },
        });
        successProfile.value = payload.profile;
    } catch (error) {
        const err = error as { data?: ErrorPayload };
        serverErrors.value = err.data?.data?.fields ?? err.data?.fields ?? {};
        serverMessage.value = getApiErrorMessage(error, '提交失败，请稍后重试');
    } finally {
        submitting.value = false;
    }
}

function resetAll() {
    Object.assign(form, initial);
    Object.assign(touched, { name: false, email: false, age: false });
    submitted.value = false;
    serverErrors.value = {};
    serverMessage.value = '';
    successProfile.value = null;
}

const SERVER_CODE = `// server/api/forms/validate.post.ts（节选）
interface ValidateBody { name?: unknown; email?: unknown; age?: unknown }

function validate(body: ValidateBody) {
    const errors: Record<string, string> = {};

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) errors.name = '姓名不能为空';
    else if (name.length < 2 || name.length > 20)
        errors.name = '姓名长度需在 2–20 个字符之间';

    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!email) errors.email = '邮箱不能为空';
    else if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))
        errors.email = '邮箱格式不正确';

    const age = typeof body.age === 'number' ? body.age : Number(body.age);
    if (!Number.isInteger(age)) errors.age = '年龄必须是整数';
    else if (age < 18 || age > 120) errors.age = '年龄需在 18–120 之间';

    return errors;
}

export default defineEventHandler(async (event) => {
    const body = (await readBody<ValidateBody>(event)) ?? {};
    const fields = validate(body);

    if (Object.keys(fields).length > 0) {
        throw createError({
            statusCode: 422,
            message: '表单校验未通过',
            data: { fields },
        });
    }

    return { ok: true, profile: body };
});`;

const CLIENT_CODE = `// 提交后按字段回填服务端错误
try {
    profile.value = await $fetch('/api/forms/validate', {
        method: 'POST',
        body: form,
    });
} catch (error) {
    const err = error as $FetchError<{
        data?: { fields?: Record<string, string> };
    }>;
    serverErrors.value = err.data?.data?.fields ?? {};
    serverMessage.value = getApiErrorMessage(error, '提交失败');
}`;

const TRAPS = [
    '客户端校验通过不等于服务端通过：类型、范围、唯一性和权限都必须在服务端重算。',
    '422 只应在格式正确但语义不合法时使用；JSON 解析失败属于 400。',
    '字段错误不要拼成一段长文案，保留结构化 fields，前端才能准确聚焦到输入框。',
    '校验失败必须保留用户已填内容，不能让用户重新输入。',
];
</script>

<template>
    <DocPage
        title="双层校验"
        description="客户端校验负责即时体验，服务端校验负责可信边界。两层共享同一套字段规则，但服务端永远保留最终否决权。"
        :tags="['客户端校验', '服务端兜底', '422', '字段错误']"
    >
        <DocSection id="model" title="两层职责边界" kicker="01 · BOUNDARY">
            <p class="body-text">
                表单校验天然分成两层：浏览器层让用户更快修正，服务端层决定数据能否落库。
                前者可以被关闭、绕过或伪造，所以<strong>任何进入服务端的值都必须重新校验</strong>。
                两层应尽量共享字段名与规则文案，避免出现“前端说没问题、后端说不对”的割裂体验。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>层</th><th>职责</th><th>失败表现</th><th>可否被绕过</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>客户端</td><td>即时反馈、减少往返</td><td>内联字段提示</td><td>可以</td></tr>
                        <tr><td>服务端</td><td>可信校验、权限与唯一性</td><td>422 + fields</td><td>不可以</td></tr>
                    </tbody>
                </table>
            </div>
            <Callout type="danger" title="常见误区">
                只在客户端做校验，等于把业务规则交给攻击者。直接发一个 curl 请求就能跳过全部前端逻辑。
            </Callout>
        </DocSection>

        <DocSection id="client" title="客户端即时校验" kicker="02 · CLIENT">
            <p class="body-text">
                演示表单对姓名、邮箱、年龄做即时计算：输入时更新错误集合，
                失焦后才显示对应字段的错误。提交时若仍有错误，直接阻止请求。
            </p>
            <DemoCard
                title="双层校验演示"
                desc="先试试留空或输入错误邮箱，再提交正确数据；服务端错误会按字段回填。"
                badge="LIVE"
            >
                <form class="form-grid" novalidate @submit.prevent="onSubmit">
                    <label class="field">
                        <span>姓名</span>
                        <input
                            v-model="form.name"
                            class="input"
                            :class="{ 'input--error': showError('name') || serverError('name') }"
                            placeholder="2–20 个字符"
                            @blur="touched.name = true"
                        />
                        <span v-if="showError('name') || serverError('name')" class="field-error">
                            {{ serverError('name') || showError('name') }}
                        </span>
                    </label>

                    <label class="field">
                        <span>邮箱</span>
                        <input
                            v-model="form.email"
                            class="input"
                            :class="{ 'input--error': showError('email') || serverError('email') }"
                            type="email"
                            placeholder="name@example.com"
                            @blur="touched.email = true"
                        />
                        <span v-if="showError('email') || serverError('email')" class="field-error">
                            {{ serverError('email') || showError('email') }}
                        </span>
                    </label>

                    <label class="field">
                        <span>年龄</span>
                        <input
                            v-model.number="form.age"
                            class="input"
                            :class="{ 'input--error': showError('age') || serverError('age') }"
                            type="number"
                            min="18"
                            max="120"
                            @blur="touched.age = true"
                        />
                        <span v-if="showError('age') || serverError('age')" class="field-error">
                            {{ serverError('age') || showError('age') }}
                        </span>
                    </label>

                    <div class="actions field--wide">
                        <button class="btn" type="submit" :disabled="submitting">
                            {{ submitting ? '提交中……' : '提交到服务端' }}
                        </button>
                        <button class="btn btn--ghost" type="button" @click="resetAll">重置</button>
                        <span class="client-state">
                            客户端：
                            <b :class="hasClientError ? 'is-error' : 'is-ok'">
                                {{ hasClientError ? '有错误' : '通过' }}
                            </b>
                        </span>
                    </div>
                </form>

                <p v-if="serverMessage" class="server-message">
                    {{ serverMessage }}
                    <span v-if="Object.keys(serverErrors).length" class="muted">
                        （服务端返回 {{ Object.keys(serverErrors).length }} 个字段错误）
                    </span>
                </p>

                <div v-if="successProfile" class="success-box">
                    <p class="success-title">服务端校验通过</p>
                    <pre class="success-json">{{ JSON.stringify(successProfile, null, 2) }}</pre>
                </div>

                <template #footer>
                    服务端返回 422 时，错误按字段精确回填；把姓名改成单字符再提交，可看到服务端与客户端规则一致的结果。
                </template>
            </DemoCard>
        </DocSection>

        <DocSection id="server" title="服务端接口与 422 协议" kicker="03 · SERVER">
            <p class="body-text">
                服务端接口位于 <code>server/api/forms/validate.post.ts</code>，
                不引入 zod，用普通函数逐字段校验。失败时抛
                <code>422</code>，并把 <code>fields</code> 放进
                <code>createError.data</code>，保持结构化错误。
            </p>
            <CodeBlock :code="SERVER_CODE" lang="ts" title="手动校验接口" />
            <p class="body-text">
                客户端收到错误后，从 <code>error.data.data.fields</code> 中读取字段错误。
                Nitro 的错误体会把 <code>createError.data</code> 嵌在响应的
                <code>data</code> 字段中，这是双层协议最容易写错的地方。
            </p>
            <CodeBlock :code="CLIENT_CODE" lang="ts" title="消费 422 错误" />
        </DocSection>

        <DocSection id="pitfalls" title="落地要点" kicker="04 · PITFALLS">
            <ul class="checklist">
                <li v-for="item in TRAPS" :key="item">{{ item }}</li>
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

.form-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    color: var(--text-muted);
}

.field--wide {
    grid-column: 1 / -1;
}

.input--error {
    border-color: var(--danger);
}

.field-error {
    color: var(--danger);
    font-size: 12px;
    line-height: 1.5;
}

.actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-top: 4px;
}

.client-state {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-faint);
}

.is-error {
    color: var(--danger);
}

.is-ok {
    color: var(--accent);
}

.server-message {
    margin: 14px 0 0;
    padding: 10px 12px;
    border: 1px solid rgba(248, 113, 113, 0.4);
    border-radius: var(--radius-sm);
    background: rgba(248, 113, 113, 0.08);
    color: var(--danger);
    font-size: 13px;
}

.success-box {
    margin-top: 14px;
    border: 1px solid var(--success-border);
    border-radius: var(--radius-sm);
    background: var(--success-soft);
    overflow: hidden;
}

.success-title {
    margin: 0;
    padding: 8px 12px;
    border-bottom: 1px solid var(--success-border);
    color: var(--success);
    font-size: 12px;
    font-weight: 600;
}

.success-json {
    margin: 0;
    border: none;
    border-radius: 0;
    background: transparent;
    font-size: 12.5px;
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

@media (max-width: 720px) {
    .form-grid {
        grid-template-columns: 1fr;
    }
}
</style>
