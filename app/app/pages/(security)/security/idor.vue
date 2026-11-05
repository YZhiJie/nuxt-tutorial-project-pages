<script setup lang="ts">
definePageMeta({ layout: 'docs' });

interface DemoRecord {
    id: number;
    title: string;
    amount: number;
    owner: string;
}

interface DemoResult {
    ok: boolean;
    status: number;
    viewer: string;
    id: number;
    record?: DemoRecord;
    message?: string;
}

const viewer = ref('demo');
const recordId = ref(1);
const result = ref<DemoResult | null>(null);
const loading = ref(false);

const viewers = ['demo', 'alice', 'admin'];
const recordIds = [1, 2];

async function load() {
    loading.value = true;
    try {
        const data = await $fetch<{ viewer: string; record: DemoRecord }>(
            `/api/security/records/${recordId.value}`,
            { headers: { 'x-demo-user': viewer.value } },
        );
        result.value = {
            ok: true,
            status: 200,
            viewer: data.viewer,
            id: recordId.value,
            record: data.record,
        };
    } catch (error) {
        const err = error as {
            statusCode?: number;
            data?: { statusCode?: number; message?: string };
        };
        result.value = {
            ok: false,
            status: err.statusCode ?? err.data?.statusCode ?? 403,
            viewer: viewer.value,
            id: recordId.value,
            message: getApiErrorMessage(error, '访问被拒绝'),
        };
    } finally {
        loading.value = false;
    }
}

const SERVER_CODE = `// server/api/security/records/[id].get.ts
const RECORDS = [
    { id: 1, title: 'Q3 财务预算', amount: 128000, owner: 'demo' },
    { id: 2, title: '招聘计划', amount: 46000, owner: 'alice' },
];

export default defineEventHandler((event) => {
    // 演示用请求头；真实项目必须从服务端会话读取
    const viewer = getHeader(event, 'x-demo-user')?.trim().toLowerCase();
    if (!viewer) {
        throw createError({ statusCode: 401, message: '缺少身份标识' });
    }

    const id = Number(getRouterParam(event, 'id'));
    const record = RECORDS.find((item) => item.id === id);
    if (!record) {
        throw createError({ statusCode: 404, message: '记录不存在' });
    }

    // 关键：对象级授权
    if (viewer !== 'admin' && record.owner !== viewer) {
        throw createError({ statusCode: 403, message: '无权访问该记录' });
    }

    return { viewer, record };
});`;

const BAD_CODE = `// 反例：只校验“登录了”，没校验“这条记录属于谁”
export default defineEventHandler(async (event) => {
    const user = requireSessionUser(event); // 已登录 ✓
    const id = Number(getRouterParam(event, 'id'));

    // 任意登录用户改一下 id 就能读别人的数据 ✗
    return await findRecord(id);
});`;

const FIX_CODE = `// 正例：认证之后，再做资源归属判断
const user = requireSessionUser(event);
const record = await findRecord(Number(getRouterParam(event, 'id')));

if (!record) {
    throw createError({ statusCode: 404, message: '记录不存在' });
}

if (record.ownerId !== user.id && user.role !== 'admin') {
    throw createError({ statusCode: 403, message: '无权访问' });
}

return record;`;

const rules = [
    '认证（Authentication）只回答“你是谁”；授权（Authorization）才回答“你能看哪条”。',
    '每个按 id 访问的接口都要做归属判断：详情、更新、删除、下载、导出、批量接口无一例外。',
    '不要只依赖不可猜测 id。随机 UUID 降低被枚举的概率，但不构成授权。',
    '资源不存在与无权访问的返回策略要统一：敏感资源可用 404 隐藏存在性。',
    '多租户系统要同时校验 tenantId 与 ownerId，避免跨租户越权。',
    '归属字段必须来自服务端数据，不能信任请求体里的 owner 或 userId。',
    '记录审计日志：谁在什么时间访问了哪条资源，越权尝试应告警。',
];

const compare = [
    { check: '是否登录', bad: '有', good: '有' },
    { check: '动作是否允许', bad: '部分', good: '有（RBAC）' },
    { check: '资源是否属于当前用户', bad: '无', good: '有（owner）' },
    { check: '跨租户校验', bad: '无', good: '有（tenantId）' },
    { check: '越权审计', bad: '无', good: '有' },
];
</script>

<template>
    <DocPage
        title="IDOR 对象级授权"
        description="IDOR（不安全直接对象引用）是最高发的越权漏洞：用户只要改一下 URL 里的 id，就能读取别人的数据。修复的关键不是藏 id，而是每次访问都校验资源归属。"
        :tags="['IDOR', '对象级授权', '403', '资源归属']"
    >
        <DocSection id="concept" title="认证不等于授权" kicker="01 · CONCEPT">
            <p class="body-text">
                “已登录”只证明身份成立，不证明有权访问某条资源。
                IDOR 的典型形态是接口用路径参数直接查库，却忘了判断
                <code>record.ownerId === session.user.id</code>。
                攻击者不需要破解密码，只需要把 <code>/records/1</code> 改成
                <code>/records/2</code>。
            </p>
            <CodeBlock :code="BAD_CODE" lang="ts" title="反例：只认证，不授权" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>检查项</th><th>漏洞接口</th><th>正确接口</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in compare" :key="row.check">
                            <td>{{ row.check }}</td>
                            <td>{{ row.bad }}</td>
                            <td>{{ row.good }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="fix" title="修复：归属校验与 403" kicker="02 · FIX">
            <p class="body-text">
                正确顺序是：读取会话 → 查询资源 → 不存在返回 404 →
                判断角色与归属 → 无权返回 403。角色只能来自服务端会话，
                前端传入的 <code>userId</code> 或 <code>owner</code> 一律不可信。
            </p>
            <CodeBlock :code="FIX_CODE" lang="ts" title="资源归属校验" />
            <Callout type="warn" title="403 与 404 的选择">
                对普通业务数据，403 语义更清晰；对财务、人事等高敏感资源，
                可用 404 隐藏“这条记录是否存在”。关键是同一类资源要保持一致，避免通过状态码差异枚举。
            </Callout>
        </DocSection>

        <DocSection id="server" title="演示接口的实现" kicker="03 · SERVER">
            <p class="body-text">
                本页接口位于 <code>server/api/security/records/[id].get.ts</code>，
                用请求头 <code>x-demo-user</code> 模拟当前用户：
                <code>demo</code> 只能读 id=1，<code>alice</code> 只能读 id=2，
                <code>admin</code> 可以读全部。
            </p>
            <CodeBlock :code="SERVER_CODE" lang="ts" title="带归属校验的接口" />
            <Callout type="danger" title="请求头不是身份">
                <code>x-demo-user</code> 完全由客户端控制，任何人都能伪造。
                它只用于本页演示。生产环境必须从 httpOnly 会话或已验证的令牌中取用户，
                绝不能信任任何客户端自报的身份。
            </Callout>
        </DocSection>

        <DocSection id="demo" title="切换用户，尝试越权" kicker="04 · DEMO">
            <p class="body-text">
                选择用户与记录 id 后发起请求。demo 读 id=2、alice 读 id=1
                会立即得到 403；admin 两条都能读。观察状态码与响应体差异。
            </p>
            <DemoCard
                title="对象级授权试验台"
                desc="demo 只能读自己的 id=1，alice 只能读 id=2，admin 可读全部。"
                badge="LIVE"
            >
                <div class="controls">
                    <div class="control-group">
                        <span class="control-label">当前用户（x-demo-user）</span>
                        <div class="control-buttons">
                            <button
                                v-for="item in viewers"
                                :key="item"
                                type="button"
                                class="btn btn--sm"
                                :class="viewer === item ? '' : 'btn--ghost'"
                                @click="viewer = item"
                            >
                                {{ item }}
                            </button>
                        </div>
                    </div>
                    <div class="control-group">
                        <span class="control-label">记录 id</span>
                        <div class="control-buttons">
                            <button
                                v-for="id in recordIds"
                                :key="id"
                                type="button"
                                class="btn btn--sm"
                                :class="recordId === id ? '' : 'btn--ghost'"
                                @click="recordId = id"
                            >
                                {{ id }}
                            </button>
                        </div>
                    </div>
                    <button class="btn" type="button" :disabled="loading" @click="load">
                        {{ loading ? '请求中……' : '读取记录' }}
                    </button>
                </div>

                <div v-if="result" class="result" :class="result.ok ? 'result--ok' : 'result--blocked'">
                    <div class="result-head">
                        <span class="badge" :class="result.ok ? 'badge--accent' : 'badge--danger'">
                            {{ result.status }}
                            {{ result.ok ? '允许' : '拒绝' }}
                        </span>
                        <span class="mono result-req">
                            GET /api/security/records/{{ result.id }} · user={{ result.viewer }}
                        </span>
                    </div>

                    <div v-if="result.record" class="record">
                        <p class="record-title">{{ result.record.title }}</p>
                        <dl class="record-meta">
                            <div><dt>记录 id</dt><dd class="mono">{{ result.record.id }}</dd></div>
                            <div><dt>归属 owner</dt><dd class="mono">{{ result.record.owner }}</dd></div>
                            <div><dt>金额</dt><dd class="mono">{{ result.record.amount.toLocaleString('zh-CN') }}</dd></div>
                        </dl>
                    </div>
                    <p v-else class="denied">{{ result.message }}</p>
                </div>
                <p v-else class="empty">选择用户与记录后点击“读取记录”。</p>

                <template #footer>
                    预期结果：demo + id1 → 200；demo + id2 → 403；alice + id1 → 403；admin + 任意 → 200。
                </template>
            </DemoCard>
        </DocSection>

        <DocSection id="rules" title="防御清单" kicker="05 · RULES">
            <ul class="checklist">
                <li v-for="item in rules" :key="item">{{ item }}</li>
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

.controls {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 16px;
}

.control-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.control-label {
    font-size: 11px;
    color: var(--text-faint);
}

.control-buttons {
    display: flex;
    gap: 6px;
}

.result {
    margin-top: 16px;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
}

.result--ok {
    border-color: var(--success-border);
}

.result--blocked {
    border-color: rgba(248, 113, 113, 0.45);
}

.result-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
}

.result-req {
    font-size: 10.5px;
    color: var(--text-faint);
    word-break: break-all;
}

.record-title {
    margin: 0 0 8px;
    font-size: 15px;
    font-weight: 600;
}

.record-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    margin: 0;
}

.record-meta dt {
    font-size: 11px;
    color: var(--text-faint);
}

.record-meta dd {
    margin: 2px 0 0;
    font-size: 13px;
}

.denied {
    margin: 0;
    font-size: 13px;
    color: var(--danger);
}

.empty {
    margin: 14px 0 0;
    font-size: 12px;
    color: var(--text-faint);
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
