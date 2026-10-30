<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const FORM_MODEL = `<!-- 单一对象建模：一次快照、一次重置、一次提交 -->
<script setup lang="ts">
interface ProfileForm {
    name: string;
    email: string;
    age: number;
}

const initial: ProfileForm = { name: '', email: '', age: 18 };
const form = reactive<ProfileForm>({ ...initial });

// 任意字段变化都会让 dirty 变 true；重置只需换一次快照
const dirty = computed(
    () => JSON.stringify(form) !== JSON.stringify(initial),
);

function reset() {
    Object.assign(form, initial);
}
<\/script>`;

const CLIENT_CHECK = `// 客户端即时校验：只负责体验，不负责安全
const touched = reactive({ name: false, email: false, age: false });

const errors = computed(() => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = '姓名不能为空';
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(form.email)) {
        next.email = '邮箱格式不正确';
    }
    if (!Number.isInteger(form.age) || form.age < 18) {
        next.age = '年龄需为不小于 18 的整数';
    }
    return next;
});

// 字段失焦后才展示错误，避免用户刚打开页面就满屏飘红
function showError(field: keyof typeof touched) {
    return touched[field] && errors.value[field];
}`;

const SERVER_CHECK = `// 服务端兜底：422 + 字段级错误
const fields = validate(body);

if (Object.keys(fields).length > 0) {
    throw createError({
        statusCode: 422,
        message: '表单校验未通过',
        data: { fields },
    });
}

// 文案可直接标注到对应输入框
// errors.data?.fields?.email → '邮箱格式不正确'`;

const OPTIMISTIC = `// 先本地插入临时项，再用服务端结果替换；失败则回滚
async function createNote(title: string) {
    const tempId = -Date.now();
    notes.value.unshift({
        id: tempId,
        title,
        excerpt: title,
        content: '',
        tags: [],
        createdAt: new Date().toISOString(),
    });

    try {
        const saved = await $fetch<Note>('/api/notes', {
            method: 'POST',
            body: { title, content: '' },
        });
        notes.value = notes.value.map((item) =>
            item.id === tempId ? saved : item,
        );
    } catch (error) {
        notes.value = notes.value.filter((item) => item.id !== tempId);
        errorMessage.value = getApiErrorMessage(error, '创建失败，已回滚');
    }
}`;

const states = [
    { state: 'idle', meaning: '未修改', ui: '主按钮可点，提交禁用或提示无变更' },
    { state: 'dirty', meaning: '有未保存修改', ui: '显示“未保存”标记与重置入口' },
    { state: 'validating', meaning: '客户端校验中', ui: '轻量内联错误，不阻塞输入' },
    { state: 'submitting', meaning: '请求在途', ui: '按钮 loading + 禁用，防重复提交' },
    { state: 'success', meaning: '服务端已确认', ui: '提示成功，刷新快照，dirty 归零' },
    { state: 'error', meaning: '客户端或服务端失败', ui: '字段错误 / 全局错误 + 重试' },
];
</script>

<template>
    <DocPage
        title="表单与变更"
        description="表单是一条完整链路：先定义可信的数据模型，再给即时反馈，最后用服务端校验兜底。变更类操作还要处理提交态、失败回滚与并发。"
        :tags="['表单建模', '双层校验', '乐观更新', '提交态']"
    >
        <DocSection id="model" title="表单建模：先确定唯一数据源" kicker="01 · MODEL">
            <p class="body-text">
                表单的第一原则是<strong>唯一数据源</strong>。把字段收敛到一个对象，
                快照、脏值判断、重置、提交和类型推导都会变得简单；字段多了以后，
                分散的 <code>ref</code> 很容易出现“重置漏一个”的经典事故。
            </p>
            <CodeBlock :code="FORM_MODEL" lang="vue" title="单一对象 + 快照重置" />
            <Callout type="tip" title="模型优先于控件">
                先确定提交给服务端的结构（字段名、类型、可空性），再决定输入控件。
                这样服务端接口、共享类型和前端表单可以共用同一份契约。
            </Callout>
        </DocSection>

        <DocSection id="client" title="客户端校验：只做体验，不做安全" kicker="02 · CLIENT">
            <p class="body-text">
                客户端校验的价值是<strong>即时反馈</strong>：少一次往返、错误定位更准。
                但它随时可以被绕过，所以不能作为信任边界。展示时机上，
                推荐“失焦后展示、输入时消除”，而不是一输入就报错。
            </p>
            <CodeBlock :code="CLIENT_CHECK" lang="ts" title="即时校验 + touched 控制展示" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>策略</th><th>优点</th><th>代价</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>输入即校验</td><td>反馈最快</td><td>未输完就飘红，干扰明显</td></tr>
                        <tr><td>失焦校验</td><td>体验与准确度平衡</td><td>需要维护 touched 状态</td></tr>
                        <tr><td>提交时校验</td><td>实现最简单</td><td>错误发现晚，返工成本高</td></tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="server" title="服务端兜底：永远不要相信浏览器" kicker="03 · SERVER">
            <p class="body-text">
                服务端必须重新校验全部约束：必填、类型、范围、格式、唯一性，
                以及与当前用户相关的权限条件。校验失败返回 <code>422</code>，
                并在 <code>data.fields</code> 中给出字段级错误，前端就能精确标红。
            </p>
            <CodeBlock :code="SERVER_CHECK" lang="ts" title="422 + fields 错误结构" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>状态码</th><th>语义</th><th>前端处理</th></tr>
                    </thead>
                    <tbody>
                        <tr><td class="mono">400</td><td>请求体格式错误</td><td>全局提示，通常说明客户端实现有 bug</td></tr>
                        <tr><td class="mono">401</td><td>未登录 / 会话失效</td><td>引导重新登录</td></tr>
                        <tr><td class="mono">403</td><td>已登录但无权限</td><td>提示无权限，不要跳登录页</td></tr>
                        <tr><td class="mono">422</td><td>语义校验失败</td><td>按字段渲染错误，保留用户输入</td></tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="optimistic" title="乐观更新：先渲染，再确认" kicker="04 · OPTIMISTIC">
            <p class="body-text">
                点赞、勾选、快速新增这类高频操作，等待服务端再更新界面会让交互显得迟钝。
                乐观更新的做法是：本地先插入一个<strong>临时 id</strong> 的占位项，
                请求成功后用真实数据替换，失败则按临时 id 精确回滚。
            </p>
            <CodeBlock :code="OPTIMISTIC" lang="ts" title="临时项 → 替换 / 回滚" />
            <ul class="checklist">
                <li>临时 id 用负数或带前缀的字符串，避免与真实自增 id 碰撞。</li>
                <li>回滚要按临时 id 删除，不能简单“删掉最后一条”，否则并发时会删错。</li>
                <li>多个请求在途时，服务端返回顺序可能与提交顺序不同，列表排序应以服务端结果为准。</li>
                <li>失败后保留用户输入，让用户可以直接重试，而不是重新填写。</li>
            </ul>
        </DocSection>

        <DocSection id="states" title="提交态总览" kicker="05 · STATES">
            <p class="body-text">
                提交态不是布尔值。至少区分未修改、脏值、校验中、提交中、成功与失败，
                才能正确决定按钮文案、禁用条件、提示位置和重试策略。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>状态</th><th>含义</th><th>界面建议</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in states" :key="row.state">
                            <td class="mono">{{ row.state }}</td>
                            <td>{{ row.meaning }}</td>
                            <td>{{ row.ui }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <Callout type="warn" title="防重复提交不只是禁用按钮">
                网络重试、用户连点、页面刷新都可能重复提交。写操作应配合幂等键
                （如 <code>Idempotency-Key</code>）或服务端唯一约束，而不是只靠前端 loading。
            </Callout>
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

.checklist {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 14px 0 0;
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
