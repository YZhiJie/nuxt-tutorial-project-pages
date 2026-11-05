<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const ISOLATION_CODE = `-- 事务边界：一次业务操作内的所有写入要么全部成功，要么全部回滚
BEGIN;
UPDATE orders SET status = 'paid', version = version + 1 WHERE id = 42 AND version = 3;
INSERT INTO payments (order_id, amount, paid_at) VALUES (42, 19900, now());
INSERT INTO audits (order_id, action, from_status, to_status) VALUES (42, 'pay', 'draft', 'paid');
COMMIT;`;

const OPTIMISTIC_CODE = `// 乐观锁：version 必须同时出现在 WHERE 与 SET
const updated = await db.orders.update({
    where: { id: 42, version: currentVersion },
    data: { status: 'paid', version: currentVersion + 1 },
});

// 影响行数为 0 → 版本冲突：不要盲目重试，先重新读取并判断状态
if (updated.count === 0) {
    const latest = await db.orders.findUnique({ where: { id: 42 } });
    if (latest?.status !== 'draft') {
        throw createError({ statusCode: 409, message: '订单状态已变化，请刷新后重试' });
    }
    // 仍可继续时再重试一次
}`;

const OVERSELL_CODE = `-- 错误做法：先查库存，再扣减（两步之间有并发窗口）
SELECT quantity FROM stock WHERE sku = 'SKU-1';
UPDATE stock SET quantity = quantity - 1 WHERE sku = 'SKU-1';

-- 正确做法：把校验写进 WHERE，一条语句完成判断 + 扣减
UPDATE stock
SET quantity = quantity - 1
WHERE sku = 'SKU-1' AND quantity >= 1;

-- 影响行数 = 0 表示库存不足，直接返回 409
-- 需要记录流水时，在同一事务内追加 stock_movements`;

const IDEMPOTENT_CODE = `-- 数据库层的幂等兜底：唯一约束比应用层判断更可靠
CREATE UNIQUE INDEX uniq_payment_request
ON payments (idempotency_key);

-- 重复请求会命中唯一冲突，捕获后读取首次结果返回
INSERT INTO payments (order_id, amount, idempotency_key)
VALUES (42, 19900, 'intent-9f1c')
ON CONFLICT (idempotency_key) DO NOTHING;

SELECT * FROM payments WHERE idempotency_key = 'intent-9f1c';`;

const OUTBOX_CODE = `// 事务内写业务 + 写 Outbox，保证「状态变更」与「消息待发」原子
await db.transaction(async (tx) => {
    await tx.orders.update({ where: { id }, data: { status: 'paid', version: { increment: 1 } } });
    await tx.outbox.create({
        data: {
            topic: 'order.paid',
            payload: JSON.stringify({ orderId: id, amount: 19900 }),
            status: 'pending',
        },
    });
});

// 独立 worker：领取 pending → 投递 → 标记 sent；失败指数退避并记录 attempt
const jobs = await db.outbox.findMany({
    where: { status: 'pending', nextRetryAt: { lte: new Date() } },
    take: 50,
});`;

const N1_CODE = `// N+1：每条订单都查一次用户，100 条订单 = 101 次查询
const orders = await db.orders.findMany();
for (const order of orders) {
    order.user = await db.users.findUnique({ where: { id: order.userId } });
}

// 修复：一次 IN 查询后在内存拼接，或直接 join
const users = await db.users.findMany({
    where: { id: { in: orders.map((order) => order.userId) } },
});
const byId = new Map(users.map((user) => [user.id, user]));
for (const order of orders) {
    order.user = byId.get(order.userId);
}`;

const isolationLevels = [
    { level: '读未提交', dirty: '可能', repeatable: '可能', phantom: '可能', fit: '几乎不用' },
    { level: '读已提交', dirty: '不会', repeatable: '可能', phantom: '可能', fit: '大多数 Web 业务默认' },
    { level: '可重复读', dirty: '不会', repeatable: '不会', phantom: '取决于实现', fit: '需要稳定快照的报表' },
    { level: '串行化', dirty: '不会', repeatable: '不会', phantom: '不会', fit: '强一致账务，性能成本最高' },
];

const checks = [
    '写操作是否都在事务内？是否有跨请求的两阶段写入？',
    '是否所有更新都带 version 或条件 WHERE？影响行数为 0 的分支是否处理？',
    '库存、余额这类热点字段是否使用条件更新，而不是先读后写？',
    '幂等键是否有唯一约束兜底？TTL 与作用域是否明确？',
    '消息发送是否走 Outbox？有没有事务提交后才发送的旁路？',
    '列表接口是否显式 join / 批量查询，避免循环内查库？',
    '慢查询是否有索引支撑？是否用 EXPLAIN 验证过执行计划？',
];
</script>

<template>
    <DocPage
        title="事务与并发"
        description="并发问题不会因为流量小就消失，它只是出现得更晚。事务、锁、幂等与 Outbox 解决的是同一件事：让写路径在并发与失败下仍然可解释。"
        :tags="['隔离级别', '乐观锁', '防超卖', 'Outbox', 'N+1']"
    >
        <DocSection id="isolation" title="隔离级别：先知道代价" kicker="01 · ISOLATION">
            <p class="body-text">
                隔离级别是用并发性能换一致性。读已提交能消除脏读，但同一事务内两次读取
                可能看到不同结果；可重复读给事务一个稳定快照；
                串行化最安全，也最容易产生锁等待与超时。
            </p>
            <CodeBlock :code="ISOLATION_CODE" lang="sql" title="事务边界与原子写入" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>级别</th><th>脏读</th><th>不可重复读</th><th>幻读</th><th>适用</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in isolationLevels" :key="row.level">
                            <td>{{ row.level }}</td>
                            <td>{{ row.dirty }}</td>
                            <td>{{ row.repeatable }}</td>
                            <td>{{ row.phantom }}</td>
                            <td>{{ row.fit }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <Callout type="warn" title="长事务是事故来源">
                事务里不要做网络请求、发消息、读大文件。事务越长，锁持有越久，
                其他请求排队越严重。把外部副作用移到事务外，用 Outbox 兜底。
            </Callout>
        </DocSection>

        <DocSection id="optimistic" title="乐观锁：用 version 检测冲突" kicker="02 · VERSION">
            <p class="body-text">
                两个用户同时打开同一张订单，一个先支付，另一个再提交发货。
                没有版本号时，后写入者会覆盖前者的状态。把 <code>version</code>
                放进 <code>WHERE</code>，第二次写入的影响行数就是 0，冲突被显式暴露。
            </p>
            <CodeBlock :code="OPTIMISTIC_CODE" lang="ts" title="版本号更新与冲突处理" />
        </DocSection>

        <DocSection id="oversell" title="防超卖：判断与扣减合成一条语句" kicker="03 · OVERSELL">
            <p class="body-text">
                「先查后改」在并发下必然出错：两个请求都读到库存 1，都认为可卖，
                然后都扣减。正确做法是把条件写进 <code>WHERE</code>，
                由数据库保证判断与扣减的原子性。
            </p>
            <CodeBlock :code="OVERSELL_CODE" lang="sql" title="条件更新" />
        </DocSection>

        <DocSection id="idempotent" title="幂等：应用层 + 数据库唯一约束" kicker="04 · IDEMPOTENCY">
            <p class="body-text">
                应用层查幂等键有竞态窗口：两个并发请求可能都没查到。
                最终防线是数据库唯一约束——冲突必然发生在一个请求身上，
                另一个读取首次结果即可。
            </p>
            <CodeBlock :code="IDEMPOTENT_CODE" lang="sql" title="唯一索引兜底" />
        </DocSection>

        <DocSection id="outbox" title="Outbox：事务与消息的一致性" kicker="05 · OUTBOX">
            <p class="body-text">
                事务提交后发送消息，如果发送失败，状态已变更但下游永远收不到通知；
                如果先发送再提交，事务回滚后下游收到一条不存在的订单。
                Outbox 把「待发消息」写进同一个事务，再由独立 worker 投递。
            </p>
            <CodeBlock :code="OUTBOX_CODE" lang="ts" title="Outbox 写入与投递" />
            <Callout type="tip" title="至少一次投递">
                下游必须按消息 id 幂等消费。Outbox 保证不丢消息，不保证不重复。
            </Callout>
        </DocSection>

        <DocSection id="n-plus-one" title="N+1 与查询预算" kicker="06 · QUERY">
            <p class="body-text">
                一个循环里查一次库，在本地看不出问题，上线后就是 100 倍查询。
                列表接口应显式声明查询次数预算，并通过 join 或批量查询达成。
            </p>
            <CodeBlock :code="N1_CODE" lang="ts" title="N+1 与批量化" />
        </DocSection>

        <DocSection id="checklist" title="上线前检查单" kicker="07 · CHECK">
            <ul class="checklist">
                <li v-for="item in checks" :key="item">{{ item }}</li>
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
