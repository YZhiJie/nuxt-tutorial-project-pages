// 订单领域模型：状态机、动作与审计日志的前后端共享契约

export const ORDER_STATUSES = ['draft', 'paid', 'shipped', 'closed'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_ACTIONS = ['pay', 'ship', 'close'] as const;
export type OrderAction = (typeof ORDER_ACTIONS)[number];

export interface Order {
    id: number;
    title: string;
    /** 金额统一用「分」的整数存储，避免浮点误差 */
    amount: number;
    status: OrderStatus;
    /** 乐观锁版本号，每次状态流转 +1 */
    version: number;
    createdAt: string;
    updatedAt: string;
}

// 只追加的审计日志：谁在什么时候把订单从什么状态改成了什么状态
export interface OrderAudit {
    id: number;
    orderId: number;
    action: 'create' | OrderAction;
    from: OrderStatus | '-';
    to: OrderStatus;
    at: string;
    idempotencyKey: string | null;
    replayed: boolean;
}

export interface OrderListResponse {
    orders: Order[];
    audit: OrderAudit[];
}
