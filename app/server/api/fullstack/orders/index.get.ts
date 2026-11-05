// 订单列表与审计日志：GET /api/fullstack/orders
export default defineEventHandler(() => {
    return listOrders();
});
