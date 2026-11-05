<script setup lang="ts">
import type {
    Order,
    OrderAction,
    OrderAudit,
    OrderListResponse,
    OrderStatus,
} from '#shared/types/order';

definePageMeta({ layout: 'docs' });

const { data, refresh } = await useFetch<OrderListResponse>('/api/fullstack/orders', {
    key: 'fullstack-orders',
});

const orders = computed(() => data.value?.orders ?? []);
const audit = computed(() => data.value?.audit ?? []);

const form = reactive({ title: '增量订阅订单', amount: 19900 });
const busy = ref(false);
const busyId = ref<number | null>(null);
const logs = ref<{ id: number; text: string; type: 'ok' | 'error'; at: string }[]>([]);
let logSeq = 0;

const NEXT_ACTION: Record<OrderStatus, OrderAction | null> = {
    draft: 'pay',
    paid: 'ship',
    shipped: 'close',
    closed: null,
};

const ACTION_LABEL: Record<OrderAction, string> = {
    pay: '支付',
    ship: '发货',
    close: '关闭',
};

const STATUS_LABEL: Record<OrderStatus, string> = {
    draft: '草稿 draft',
    paid: '已支付 paid',
    shipped: '已发货 shipped',
    closed: '已关闭 closed',
};

function nextActionOf(order: Order): OrderAction {
    return NEXT_ACTION[order.status] ?? 'pay';
}

function statusOf(error: unknown, fallback = 500): number {
    const e = error as { statusCode?: number; data?: { statusCode?: number } };
    return e.statusCode ?? e.data?.statusCode ?? fallback;
}

function log(text: string, type: 'ok' | 'error') {
    logs.value = [
        {
            id: logSeq++,
            text,
            type,
            at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        },
        ...logs.value,
    ].slice(0, 8);
}

function yuan(cents: number): string {
    return (cents / 100).toFixed(2);
}

async function postCreate(key: string) {
    return await $fetch<{ order: Order; replayed: boolean }>('/api/fullstack/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: { title: form.title.trim(), amount: Number(form.amount) },
    });
}

async function createOrder(replay: boolean) {
    if (busy.value) return;
    const amount = Number(form.amount);
    if (!form.title.trim()) {
        log('订单标题不能为空', 'error');
        return;
    }
    if (!Number.isInteger(amount) || amount <= 0) {
        log('金额必须是大于 0 的整数（单位：分）', 'error');
        return;
    }

    busy.value = true;
    // 幂等键应来自客户端一次「业务意图」，而不是每次点击随机生成
    const key = replay ? 'demo-create-key' : `demo-create-${Date.now()}`;
    try {
        const first = await postCreate(key);
        if (replay) {
            const second = await postCreate(key);
            log(
                `首次 #${first.order.id} → 重放 #${second.order.id}，replayed=${second.replayed}`,
                'ok',
            );
        } else {
            log(`创建 #${first.order.id}（201），状态 draft`, 'ok');
        }
        await refresh();
    } catch (error) {
        log(`${statusOf(error)} ${getApiErrorMessage(error)}`, 'error');
    } finally {
        busy.value = false;
    }
}

async function transition(order: Order, action: OrderAction) {
    busyId.value = order.id;
    const key = `order-${order.id}-${action}`;
    try {
        const result = await $fetch<{
            ok: true;
            order: Order;
            audit: OrderAudit;
            replayed: boolean;
        }>(`/api/fullstack/orders/${order.id}/transition`, {
            method: 'POST',
            headers: { 'Idempotency-Key': key },
            body: { action },
        });
        log(
            `#${order.id} ${ACTION_LABEL[action]} → ${result.order.status}，replayed=${result.replayed}`,
            'ok',
        );
        await refresh();
    } catch (error) {
        log(`${statusOf(error)} ${getApiErrorMessage(error)}`, 'error');
    } finally {
        busyId.value = null;
    }
}

// 故意触发非法流转：draft 只能 pay，其它状态 pay 都不合法
async function invalid(order: Order) {
    const action: OrderAction = order.status === 'draft' ? 'ship' : 'pay';
    busyId.value = order.id;
    try {
        await $fetch(`/api/fullstack/orders/${order.id}/transition`, {
            method: 'POST',
            headers: { 'Idempotency-Key': `invalid-${order.id}-${Date.now()}` },
            body: { action },
        });
        log('意外成功：状态机没有拦截', 'error');
    } catch (error) {
        log(`${statusOf(error)} ${getApiErrorMessage(error)}`, 'error');
    } finally {
        busyId.value = null;
    }
}

const MACHINE_CODE = `// server/utils/fullstack/order-store.ts —— 全站唯一的状态机定义
const NEXT: Record<OrderStatus, Partial<Record<OrderAction, OrderStatus>>> = {
    draft: { pay: 'paid' },
    paid: { ship: 'shipped' },
    shipped: { close: 'closed' },
    closed: {},
};

// 非法流转不是程序 bug，而是业务冲突：返回 409 而不是 500
const next = NEXT[order.status][action];
if (!next) {
    throw createError({
        statusCode: 409,
        message: '订单当前为 ' + order.status + '，不允许执行 ' + action,
        data: { code: 'INVALID_TRANSITION', currentStatus: order.status },
    });
}`;

const IDEMPOTENCY_CODE = `// 服务端：请求头携带业务幂等键
const key = getHeader(event, 'idempotency-key')?.trim() || null;
const result = createOrder({ title, amount }, key);

// store 内：命中幂等键直接返回首次结果快照，不再创建
const cached = createKeys.get(key);
if (cached) {
    return { order: { ...cached.order }, replayed: true };
}

// 客户端：同一个 key 只允许重试同一个请求
await $fetch('/api/fullstack/orders', {
    method: 'POST',
    headers: { 'Idempotency-Key': intentId },
    body: { title, amount },
});`;

const AUDIT_CODE = `// 审计与业务写入在同一事务内完成，只追加、不修改
await db.transaction(async (tx) => {
    const updated = await tx.orders.update({ status: next, version: order.version + 1 });
    await tx.audits.insert({
        orderId: order.id,
        action,
        from: order.status,
        to: updated.status,
        at: new Date().toISOString(),
        idempotencyKey: key,
        replayed: false,
    });
});`;

const production = [
    '幂等键要持久化并设置 TTL（例如 24 小时），进程内 Map 重启即失效。',
    '幂等键的作用域是「租户 + 用户 + 业务意图」，不能只用一个全局 key。',
    '状态流转必须放在事务里，并配合 version 做乐观锁，否则并发支付会重复推进。',
    '审计日志只能追加：禁止 update / delete，读取走独立的只读副本或归档表。',
    '订单金额用整数分存储；展示层再格式化，避免浮点误差进入账务。',
];
</script>

<template>
    <DocPage
        title="企业级综合场景"
        description="把订单当作真实业务：状态机约束流转，幂等键吸收重试，审计日志留下证据。三者共同构成一条可重放的写路径。"
        :tags="['状态机', '幂等键', '409', '审计日志', '乐观锁']"
    >
        <DocSection id="machine" title="领域建模与状态机" kicker="01 · STATE MACHINE">
            <p class="body-text">
                状态不是数据库里的一个字符串，而是一组被明确允许的迁移。
                把合法迁移写成一张表，非法请求就会在入口被挡住，而不是在数据里留下
                <code>paid → draft</code> 这种无法解释的记录。
            </p>
            <CodeBlock :code="MACHINE_CODE" lang="ts" title="状态机与 409" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>当前状态</th><th>允许动作</th><th>结果</th><th>非法示例</th></tr>
                    </thead>
                    <tbody>
                        <tr><td class="mono">draft</td><td>pay</td><td class="mono">paid</td><td>ship → 409</td></tr>
                        <tr><td class="mono">paid</td><td>ship</td><td class="mono">shipped</td><td>pay → 409</td></tr>
                        <tr><td class="mono">shipped</td><td>close</td><td class="mono">closed</td><td>ship → 409</td></tr>
                        <tr><td class="mono">closed</td><td>—</td><td class="mono">closed</td><td>任何动作 → 409</td></tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="idempotency" title="幂等键：重试不等于重复" kicker="02 · IDEMPOTENCY">
            <p class="body-text">
                网络超时后客户端无法判断服务端是否已处理。幂等键把「同一次业务意图」绑定到
                一个 key：第一次执行真正落库，后续相同 key 直接返回首次结果，并标记
                <code>replayed: true</code>。
            </p>
            <CodeBlock :code="IDEMPOTENCY_CODE" lang="ts" title="幂等键的读写位置" />
            <Callout type="warn" title="顺序决定正确性">
                必须先查幂等键、再校验状态机。反过来的话，第一次成功后订单已变成
                <code>paid</code>，重放请求会被判成非法流转，客户端会误以为失败。
            </Callout>
        </DocSection>

        <DocSection id="audit" title="审计日志：只追加的事实" kicker="03 · AUDIT">
            <p class="body-text">
                审计回答的是「谁、在什么时候、把什么改成了什么」。
                它与业务写入放在同一事务里，保证不会出现“订单变了但日志没写”的中间态。
            </p>
            <CodeBlock :code="AUDIT_CODE" lang="ts" title="审计与业务同事务" />
        </DocSection>

        <DocSection id="demo" title="订单演示" kicker="04 · LIVE">
            <p class="body-text">
                创建订单后依次点击「支付 → 发货 → 关闭」。点击「触发 409」可以验证非法流转；
                「幂等重放」会用同一个 key 连续提交两次，观察返回的订单号是否相同。
            </p>
            <DemoCard
                title="订单状态机 + 幂等 + 审计"
                desc="所有操作都走 /api/fullstack/orders；金额单位为分。"
                badge="LIVE"
            >
                <div class="create-row">
                    <input v-model="form.title" class="input" type="text" placeholder="订单标题" />
                    <input v-model.number="form.amount" class="input input--amount" type="number" min="1" step="1" />
                    <button class="btn" type="button" :disabled="busy" @click="createOrder(false)">
                        {{ busy ? '提交中' : '创建订单' }}
                    </button>
                    <button class="btn btn--ghost" type="button" :disabled="busy" @click="createOrder(true)">
                        幂等重放
                    </button>
                </div>
                <p class="form-hint">金额单位：分（19900 = 199.00 元）</p>

                <ul class="order-list">
                    <li v-for="order in orders" :key="order.id" class="order-row">
                        <div class="order-main">
                            <p class="order-title">
                                <span class="mono order-id">#{{ order.id }}</span>
                                {{ order.title }}
                            </p>
                            <p class="order-meta mono">
                                ¥{{ yuan(order.amount) }} · v{{ order.version }} ·
                                {{ STATUS_LABEL[order.status] }}
                            </p>
                        </div>
                        <div class="order-actions">
                            <button
                                v-if="NEXT_ACTION[order.status]"
                                class="btn btn--sm"
                                type="button"
                                :disabled="busyId === order.id"
                                @click="transition(order, nextActionOf(order))"
                            >
                                {{ ACTION_LABEL[nextActionOf(order)] }}
                            </button>
                            <button
                                class="btn btn--ghost btn--sm"
                                type="button"
                                :disabled="busyId === order.id"
                                @click="invalid(order)"
                            >
                                触发 409
                            </button>
                            <span class="badge" :class="`badge--${order.status}`">{{ order.status }}</span>
                        </div>
                    </li>
                </ul>
                <p v-if="!orders.length" class="empty">暂无订单。</p>

                <div v-if="logs.length" class="log-list">
                    <div v-for="entry in logs" :key="entry.id" class="log-row">
                        <span class="mono log-time">{{ entry.at }}</span>
                        <span class="log-text" :class="entry.type === 'error' ? 'log-text--error' : 'log-text--ok'">
                            {{ entry.text }}
                        </span>
                    </div>
                </div>

                <template #footer>
                    审计日志（最新在前）：
                    <span v-if="audit.length">共 {{ audit.length }} 条，最近一条 #{{ audit[0]?.id }} {{ audit[0]?.action }}</span>
                    <span v-else>暂无记录</span>
                </template>
            </DemoCard>
        </DocSection>

        <DocSection id="production" title="生产化差异" kicker="05 · PRODUCTION">
            <ul class="checklist">
                <li v-for="item in production" :key="item">{{ item }}</li>
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

.create-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.create-row .input {
    flex: 1 1 200px;
}

.input--amount {
    flex: 0 0 110px;
}

.form-hint {
    margin: 8px 0 0;
    font-size: 11px;
    color: var(--text-faint);
}

.order-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 16px 0 0;
    padding: 0;
    list-style: none;
}

.order-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
}

.order-main {
    min-width: 0;
}

.order-title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
}

.order-id {
    margin-right: 6px;
    color: var(--accent);
    font-size: 11px;
}

.order-meta {
    margin: 3px 0 0;
    font-size: 11px;
    color: var(--text-muted);
}

.order-actions {
    display: flex;
    align-items: center;
    gap: 6px;
}

.badge--draft {
    border-color: var(--line-strong);
    color: var(--text-muted);
}

.badge--paid {
    border-color: rgba(34, 211, 238, 0.45);
    background: rgba(34, 211, 238, 0.1);
    color: var(--info);
}

.badge--shipped {
    border-color: var(--success-border);
    background: var(--success-soft);
    color: var(--success);
}

.badge--closed {
    border-color: rgba(251, 191, 36, 0.4);
    color: var(--warn);
}

.empty {
    margin: 14px 0 0;
    font-size: 12px;
    color: var(--text-faint);
}

.log-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
}

.log-row {
    display: flex;
    gap: 10px;
    font-size: 12px;
}

.log-time {
    flex-shrink: 0;
    color: var(--text-faint);
    font-size: 11px;
}

.log-text--ok {
    color: var(--accent);
}

.log-text--error {
    color: var(--danger);
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
</style>
