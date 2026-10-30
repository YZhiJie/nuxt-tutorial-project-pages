<script setup lang="ts">
definePageMeta({ layout: 'docs' });

type Role = 'admin' | 'editor' | 'viewer';
type Resource = 'docs' | 'comments' | 'users' | 'billing';

const ROLES: Array<{ key: Role; label: string; desc: string }> = [
    { key: 'viewer', label: 'viewer', desc: '只读访客' },
    { key: 'editor', label: 'editor', desc: '内容编辑' },
    { key: 'admin', label: 'admin', desc: '管理员' },
];

const MATRIX: Array<{
    resource: Resource;
    label: string;
    actions: Array<{ key: string; label: string }>;
}> = [
    {
        resource: 'docs',
        label: '文档',
        actions: [
            { key: 'read', label: '查看' },
            { key: 'create', label: '新建' },
            { key: 'update', label: '编辑' },
            { key: 'delete', label: '删除' },
        ],
    },
    {
        resource: 'comments',
        label: '评论',
        actions: [
            { key: 'read', label: '查看' },
            { key: 'create', label: '发表' },
            { key: 'delete', label: '删除' },
        ],
    },
    {
        resource: 'users',
        label: '用户',
        actions: [
            { key: 'read', label: '查看' },
            { key: 'manage', label: '管理' },
        ],
    },
    {
        resource: 'billing',
        label: '账单',
        actions: [
            { key: 'read', label: '查看' },
            { key: 'manage', label: '管理' },
        ],
    },
];

// 权限表：角色 → 允许的“资源:动作”集合
const PERMISSIONS: Record<Role, string[]> = {
    viewer: ['docs:read', 'comments:read'],
    editor: [
        'docs:read',
        'docs:create',
        'docs:update',
        'comments:read',
        'comments:create',
        'comments:delete',
    ],
    admin: [
        'docs:read',
        'docs:create',
        'docs:update',
        'docs:delete',
        'comments:read',
        'comments:create',
        'comments:delete',
        'users:read',
        'users:manage',
        'billing:read',
        'billing:manage',
    ],
};

const role = ref<Role>('editor');

function can(currentRole: Role, resource: Resource, action: string): boolean {
    return PERMISSIONS[currentRole].includes(`${resource}:${action}`);
}

const allowedCount = computed(() =>
    MATRIX.reduce(
        (total, row) =>
            total + row.actions.filter((action) => can(role.value, row.resource, action.key)).length,
        0,
    ),
);

const totalCount = computed(() =>
    MATRIX.reduce((total, row) => total + row.actions.length, 0),
);

const MODEL_CODE = `type Role = 'admin' | 'editor' | 'viewer';
type Resource = 'docs' | 'comments' | 'users' | 'billing';
type Action = 'read' | 'create' | 'update' | 'delete' | 'manage';

// 角色 → 允许的“资源:动作”集合
const PERMISSIONS: Record<Role, string[]> = {
    viewer: ['docs:read', 'comments:read'],
    editor: [
        'docs:read', 'docs:create', 'docs:update',
        'comments:read', 'comments:create', 'comments:delete',
    ],
    admin: ['*'], // 或显式列全，便于审计
};

function can(role: Role, resource: Resource, action: Action) {
    const allowed = PERMISSIONS[role];
    return allowed.includes('*') || allowed.includes(\`\${resource}:\${action}\`);
}`;

const SERVER_CODE = `// 服务端：角色只从会话读取，绝不从请求体 / 请求头取
export default defineEventHandler(async (event) => {
    const user = requireSessionUser(event);

    // 1) 功能级授权：该角色能否执行此动作
    if (!can(user.role, 'docs', 'update')) {
        throw createError({ statusCode: 403, message: '无编辑权限' });
    }

    // 2) 资源级授权：这条数据是否属于当前用户
    const doc = await findDoc(Number(getRouterParam(event, 'id')));
    if (!doc) {
        throw createError({ statusCode: 404, message: '文档不存在' });
    }
    if (user.role !== 'admin' && doc.ownerId !== user.id) {
        throw createError({ statusCode: 403, message: '无权修改他人文档' });
    }

    return updateDoc(doc, await readBody(event));
});`;

const UI_CODE = `// 前端：只做渲染控制，不能当作安全边界
const { user } = useAuth();

const canEdit = computed(() =>
    user.value ? can(user.value.role, 'docs', 'update') : false,
);

// 隐藏按钮 ≠ 阻止请求；攻击者可以直接调用接口
<button v-if="canEdit">编辑</button>`;

const problems = [
    '角色必须由服务端会话决定，不能接受前端传入的 role 字段。',
    '功能级权限（能不能进入模块）与资源级权限（能不能操作这一条）必须分开判断。',
    '编辑器通常只能改自己的文档；管理员可以跨用户，但要留审计日志。',
    '权限变更后应使旧会话或缓存失效，否则降权不会立即生效。',
    '批量接口、导出接口、关联对象接口同样要校验，不能只守单条详情接口。',
];
</script>

<template>
    <DocPage
        title="RBAC 权限模型"
        description="RBAC 把权限拆成角色、资源与动作三个维度。前端用它控制界面可见性，服务端用它做最终授权，并在资源级判断“这条数据属于谁”。"
        :tags="['RBAC', '角色矩阵', '资源级授权', '403', '服务端二次校验']"
    >
        <DocSection id="model" title="角色 × 资源 × 动作" kicker="01 · MODEL">
            <p class="body-text">
                RBAC 的核心不是“用户是不是管理员”，而是“当前角色能否对某类资源执行某个动作”。
                把它显式建模成 <code>resource:action</code> 集合，权限判断就变成一个纯函数，
                前端展示、服务端校验和测试都可以复用同一套规则。
            </p>
            <CodeBlock :code="MODEL_CODE" lang="ts" title="权限表与 can()" />
            <Callout type="info" title="显式优于通配">
                教学中常用 <code>'*'</code> 简化管理员权限；生产环境建议显式列全，
                这样新增资源时不会意外把权限送给所有管理员，审计也更清晰。
            </Callout>
        </DocSection>

        <DocSection id="matrix" title="角色权限矩阵" kicker="02 · MATRIX">
            <p class="body-text">
                矩阵是权限设计的最小可评审单元。产品、运营与安全一起看这张表，
                比读代码更容易发现“viewer 不该有删除”“editor 不该看账单”这类问题。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>资源 / 动作</th>
                            <th>viewer</th>
                            <th>editor</th>
                            <th>admin</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in MATRIX" :key="row.resource">
                            <td>{{ row.label }}<span class="mono res-key">（{{ row.resource }}）</span></td>
                            <td>
                                <span
                                    v-for="action in row.actions"
                                    :key="action.key"
                                    class="cell-tag"
                                    :class="can('viewer', row.resource, action.key) ? 'cell-tag--ok' : 'cell-tag--no'"
                                >
                                    {{ action.label }}
                                </span>
                            </td>
                            <td>
                                <span
                                    v-for="action in row.actions"
                                    :key="action.key"
                                    class="cell-tag"
                                    :class="can('editor', row.resource, action.key) ? 'cell-tag--ok' : 'cell-tag--no'"
                                >
                                    {{ action.label }}
                                </span>
                            </td>
                            <td>
                                <span
                                    v-for="action in row.actions"
                                    :key="action.key"
                                    class="cell-tag"
                                    :class="can('admin', row.resource, action.key) ? 'cell-tag--ok' : 'cell-tag--no'"
                                >
                                    {{ action.label }}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="server" title="服务端必须二次校验" kicker="03 · SERVER">
            <p class="body-text">
                角色来自服务端会话，前端传来的 <code>role</code>、<code>userId</code>
                一律不可信。服务端先做功能级授权，再加载资源做归属判断，
                两步都通过才允许写操作。
            </p>
            <CodeBlock :code="SERVER_CODE" lang="ts" title="功能级 + 资源级授权" />
            <CodeBlock :code="UI_CODE" lang="ts" title="前端只做展示控制" />
            <Callout type="danger" title="IDOR 高发点">
                详情接口最容易漏掉归属判断：只要改一下 URL 里的 id，
                就能读到别人的数据。详见安全模块的 IDOR 页面。
            </Callout>
        </DocSection>

        <DocSection id="demo" title="切换角色，实时计算" kicker="04 · DEMO">
            <p class="body-text">
                下面用同一个 <code>can()</code> 函数实时计算当前角色的可用动作。
                切换角色只改变展示结果；真实系统里角色由会话读取，页面无权修改。
            </p>
            <DemoCard
                title="角色权限计算器"
                desc="切换 viewer / editor / admin，观察每个资源动作的允许状态与统计。"
                badge="LIVE"
            >
                <div class="role-switch">
                    <button
                        v-for="item in ROLES"
                        :key="item.key"
                        type="button"
                        class="btn btn--sm"
                        :class="role === item.key ? '' : 'btn--ghost'"
                        @click="role = item.key"
                    >
                        {{ item.label }}
                    </button>
                    <span class="role-desc">{{ ROLES.find((item) => item.key === role)?.desc }}</span>
                </div>

                <div class="summary">
                    当前角色 <b class="mono">{{ role }}</b>
                    允许 <b class="mono">{{ allowedCount }}</b> / {{ totalCount }} 个动作
                </div>

                <div class="permission-grid">
                    <div v-for="row in MATRIX" :key="row.resource" class="permission-row">
                        <div class="resource-name">
                            {{ row.label }}
                            <span class="mono res-key">{{ row.resource }}</span>
                        </div>
                        <ul class="action-list">
                            <li
                                v-for="action in row.actions"
                                :key="action.key"
                                class="action-item"
                                :class="can(role, row.resource, action.key) ? 'action-item--ok' : 'action-item--no'"
                            >
                                <span class="action-mark">
                                    {{ can(role, row.resource, action.key) ? '✓' : '×' }}
                                </span>
                                {{ action.label }}
                                <span class="mono action-key">{{ action.key }}</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <template #footer>
                    前端计算结果只用于界面控制；任何按钮被隐藏后，接口仍需独立校验角色与资源归属。
                </template>
            </DemoCard>
        </DocSection>

        <DocSection id="pitfalls" title="落地检查单" kicker="05 · PITFALLS">
            <ul class="checklist">
                <li v-for="item in problems" :key="item">{{ item }}</li>
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

.res-key {
    color: var(--text-faint);
    font-size: 11px;
}

.cell-tag {
    display: inline-block;
    margin: 2px 4px 2px 0;
    padding: 1px 7px;
    border-radius: 999px;
    border: 1px solid var(--line);
    font-size: 11px;
}

.cell-tag--ok {
    border-color: var(--success-border);
    color: var(--success);
}

.cell-tag--no {
    color: var(--text-faint);
    text-decoration: line-through;
}

.role-switch {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
}

.role-desc {
    margin-left: 4px;
    font-size: 12px;
    color: var(--text-muted);
}

.summary {
    margin: 16px 0 12px;
    font-size: 12px;
    color: var(--text-muted);
}

.summary b {
    color: var(--accent);
    font-size: 14px;
}

.permission-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

.permission-row {
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
}

.resource-name {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 600;
}

.action-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.action-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border: 1px solid var(--line);
    border-radius: 6px;
    font-size: 11px;
}

.action-mark {
    font-family: var(--font-mono);
    font-weight: 700;
}

.action-key {
    color: var(--text-faint);
    font-size: 10px;
}

.action-item--ok {
    border-color: var(--success-border);
    color: var(--success);
}

.action-item--no {
    color: var(--text-faint);
    opacity: 0.75;
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

@media (max-width: 620px) {
    .permission-grid {
        grid-template-columns: 1fr;
    }
}
</style>
