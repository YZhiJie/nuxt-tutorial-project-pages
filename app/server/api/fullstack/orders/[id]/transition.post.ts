import type { OrderAction } from '#shared/types/order';

// 订单状态流转：POST /api/fullstack/orders/:id/transition
// body: { action: 'pay' | 'ship' | 'close' }
// 非法流转返回 409；同一 Idempotency-Key 重放返回首次结果
export default defineEventHandler(async (event) => {
    const raw = getRouterParam(event, 'id');
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
        throw createError({ statusCode: 400, message: '非法的订单 id' });
    }

    const body = await readBody<{ action?: string }>(event);
    const action = String(body?.action ?? '');
    if (!['pay', 'ship', 'close'].includes(action)) {
        throw createError({ statusCode: 400, message: '非法动作，仅支持 pay / ship / close' });
    }

    const idempotencyKey = getHeader(event, 'idempotency-key')?.trim() || null;
    const result = transitionOrder(id, action as OrderAction, idempotencyKey);

    if (!result.ok) {
        throw createError({
            statusCode: result.code === 'NOT_FOUND' ? 404 : 409,
            message: result.message,
            data: { code: result.code, currentStatus: result.currentStatus },
        });
    }

    return result;
});
