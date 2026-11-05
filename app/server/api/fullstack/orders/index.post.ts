// 创建订单：POST /api/fullstack/orders
// 可选请求头 Idempotency-Key：同一 key 的重放返回首次结果，不再生成新订单
export default defineEventHandler(async (event) => {
    const body = await readBody<{ title?: string; amount?: number }>(event);

    const title = String(body?.title ?? '').trim();
    if (!title) {
        throw createError({ statusCode: 400, message: '订单标题不能为空' });
    }

    const amount = Number(body?.amount);
    if (!Number.isInteger(amount) || amount <= 0) {
        throw createError({ statusCode: 400, message: '金额必须是大于 0 的整数（单位：分）' });
    }

    const idempotencyKey = getHeader(event, 'idempotency-key')?.trim() || null;
    const result = createOrder({ title, amount }, idempotencyKey);

    setResponseStatus(event, result.replayed ? 200 : 201);
    return result;
});
