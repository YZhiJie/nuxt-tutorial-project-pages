import type {
    Order,
    OrderAction,
    OrderAudit,
    OrderListResponse,
    OrderStatus,
} from '#shared/types/order';

// ===== 内存存储（模块级变量）=====
// dev / 演示可用；生产必须换成数据库或 Redis，并保证并发安全
const orders = new Map<number, Order>();
const audits: OrderAudit[] = [];

// 幂等键 → 首次执行的结果快照；生产应持久化并设置 TTL
const createKeys = new Map<string, { order: Order; auditId: number }>();
const transitionKeys = new Map<string, TransitionSuccess>();

let orderSeq = 0;
let auditSeq = 0;
let seeded = false;

// 状态机：只有这些流转合法，其余一律 409
const NEXT: Record<OrderStatus, Partial<Record<OrderAction, OrderStatus>>> = {
    draft: { pay: 'paid' },
    paid: { ship: 'shipped' },
    shipped: { close: 'closed' },
    closed: {},
};

export const ACTION_LABELS: Record<OrderAction, string> = {
    pay: '支付',
    ship: '发货',
    close: '关闭',
};

export interface TransitionSuccess {
    ok: true;
    order: Order;
    audit: OrderAudit;
    replayed: boolean;
}

export interface TransitionFailure {
    ok: false;
    code: 'NOT_FOUND' | 'INVALID_TRANSITION';
    message: string;
    currentStatus: OrderStatus | null;
}

export type TransitionResult = TransitionSuccess | TransitionFailure;

function now(): string {
    return new Date().toISOString();
}

function pushAudit(input: {
    orderId: number;
    action: 'create' | OrderAction;
    from: OrderStatus | '-';
    to: OrderStatus;
    idempotencyKey: string | null;
    replayed: boolean;
}): OrderAudit {
    const entry: OrderAudit = {
        id: ++auditSeq,
        orderId: input.orderId,
        action: input.action,
        from: input.from,
        to: input.to,
        at: now(),
        idempotencyKey: input.idempotencyKey,
        replayed: input.replayed,
    };
    audits.push(entry);
    return entry;
}

// 首次访问写入一张草稿订单，让演示有起点
function seed(): void {
    if (seeded) return;
    seeded = true;

    const createdAt = '2026-10-08T06:30:00.000Z';
    const order: Order = {
        id: ++orderSeq,
        title: '示例订单：年度订阅',
        amount: 19900,
        status: 'draft',
        version: 1,
        createdAt,
        updatedAt: createdAt,
    };
    orders.set(order.id, order);
    pushAudit({
        orderId: order.id,
        action: 'create',
        from: '-',
        to: 'draft',
        idempotencyKey: null,
        replayed: false,
    });
}

export function listOrders(): OrderListResponse {
    seed();
    return {
        orders: [...orders.values()].sort((a, b) => b.id - a.id),
        audit: [...audits].reverse(),
    };
}

// 创建订单：带 Idempotency-Key 时，重复请求返回首次结果
export function createOrder(
    input: { title: string; amount: number },
    idempotencyKey: string | null,
): { order: Order; replayed: boolean } {
    seed();

    if (idempotencyKey) {
        const cached = createKeys.get(idempotencyKey);
        if (cached) {
            pushAudit({
                orderId: cached.order.id,
                action: 'create',
                from: '-',
                to: cached.order.status,
                idempotencyKey,
                replayed: true,
            });
            return { order: { ...cached.order }, replayed: true };
        }
    }

    const at = now();
    const order: Order = {
        id: ++orderSeq,
        title: input.title,
        amount: input.amount,
        status: 'draft',
        version: 1,
        createdAt: at,
        updatedAt: at,
    };
    orders.set(order.id, order);
    const audit = pushAudit({
        orderId: order.id,
        action: 'create',
        from: '-',
        to: 'draft',
        idempotencyKey,
        replayed: false,
    });
    if (idempotencyKey) {
        createKeys.set(idempotencyKey, { order: { ...order }, auditId: audit.id });
    }
    return { order, replayed: false };
}

// 状态流转：先查幂等键，再校验状态机；非法流转返回 409 语义
export function transitionOrder(
    id: number,
    action: OrderAction,
    idempotencyKey: string | null,
): TransitionResult {
    seed();

    if (idempotencyKey) {
        const cached = transitionKeys.get(idempotencyKey);
        if (cached) {
            const audit = pushAudit({
                orderId: cached.order.id,
                action,
                from: cached.audit.from,
                to: cached.order.status,
                idempotencyKey,
                replayed: true,
            });
            return { ok: true, order: { ...cached.order }, audit, replayed: true };
        }
    }

    const order = orders.get(id);
    if (!order) {
        return {
            ok: false,
            code: 'NOT_FOUND',
            message: '订单不存在',
            currentStatus: null,
        };
    }

    const next = NEXT[order.status][action];
    if (!next) {
        return {
            ok: false,
            code: 'INVALID_TRANSITION',
            message: `订单当前为 ${order.status}，不允许执行 ${action}`,
            currentStatus: order.status,
        };
    }

    const updated: Order = {
        ...order,
        status: next,
        version: order.version + 1,
        updatedAt: now(),
    };
    orders.set(id, updated);
    const audit = pushAudit({
        orderId: id,
        action,
        from: order.status,
        to: next,
        idempotencyKey,
        replayed: false,
    });
    const result: TransitionSuccess = { ok: true, order: updated, audit, replayed: false };
    if (idempotencyKey) {
        transitionKeys.set(idempotencyKey, { ...result, order: { ...updated } });
    }
    return result;
}
