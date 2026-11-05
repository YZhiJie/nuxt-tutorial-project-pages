<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const SERVER_TREE = `server/
├── api/                                  文件路径 = URL
│   ├── notes/index.get.ts                GET    /api/notes
│   └── fullstack/
│       ├── items/index.get.ts            GET    /api/fullstack/items
│       ├── items/index.post.ts           POST   /api/fullstack/items
│       ├── items/[id].delete.ts          DELETE /api/fullstack/items/:id
│       ├── orders/index.get.ts           GET    /api/fullstack/orders
│       ├── orders/index.post.ts          POST   /api/fullstack/orders
│       └── orders/[id]/transition.post.ts POST  /api/fullstack/orders/:id/transition
├── middleware/                            每个请求的前置钩子
└── utils/                                 服务端自动导入的业务函数
    ├── notes/repository.ts
    └── fullstack/
        ├── item-store.ts                 KV CRUD
        └── order-store.ts                状态机 + 幂等 + 审计`;

const CONTRACT_CODE = `// 约定优先于实现：同一资源的四种结果
// 200 成功读取 / 201 创建成功 / 204 删除成功（无响应体）/ 400 入参非法
// 401 未认证 / 403 无权限 / 404 资源不存在 / 409 状态冲突 / 429 限流
// 500 未预期错误：只暴露 requestId，不暴露堆栈

export default defineEventHandler(async (event) => {
    const body = await readBody<Partial<FullstackItemInput>>(event);
    if (!String(body?.title ?? '').trim()) {
        throw createError({ statusCode: 400, message: '标题不能为空' });
    }
    const item = await createItem({ title: body.title });
    setResponseStatus(event, 201);
    return item;
});`;

const STORAGE_CODE = `// nuxt.config.ts 中声明的命名空间（本页只展示，不修改配置）
nitro: {
    storage: {
        data: { driver: 'fs', base: './.data/kv' },
    },
},

// 服务端按命名空间取实例；key 设计要带业务前缀
const storage = useStorage<FullstackItem[]>('data');
await storage.setItem('fullstack-items', items);
const stored = await storage.getItem('fullstack-items');`;

const WRITE_PATH_CODE = `// 一次写入涉及的三道保险（生产伪代码）
async function handleTransition(orderId, action, idempotencyKey) {
    // 1. 幂等：同一个 key 直接返回首次结果快照，不再执行业务
    const cached = await idempotency.get(idempotencyKey);
    if (cached) return cached;

    // 2. 原子：事务内读取当前状态、校验状态机、版本号 +1
    return await db.transaction(async (tx) => {
        const order = await tx.orders.findForUpdate(orderId);
        assertTransition(order.status, action);
        const updated = await tx.orders.update({
            status: nextStatus(order.status, action),
            version: order.version + 1,
        });
        // 3. 审计：与业务写入同一事务，禁止旁路写日志
        await tx.audits.insert({ orderId, action, from: order.status, to: updated.status });
        return updated;
    });
}`;

const storageOptions = [
    { type: 'Nitro KV（useStorage）', fit: '配置、缓存、演示数据', pros: '零依赖、可切 Redis / S3', limit: '无索引、全量读写、无事务' },
    { type: 'SQLite / Postgres', fit: '订单、用户、账务等核心实体', pros: '事务、索引、约束、迁移', limit: '需要连接池与迁移流程' },
    { type: 'Redis', fit: '会话、限流计数、幂等键', pros: '原子操作、TTL、低延迟', limit: '不适合作为唯一事实来源' },
    { type: '对象存储', fit: '文件、导出包、备份', pros: '容量与成本友好', limit: '不适合高频小对象读写' },
];

const statusTable = [
    { code: '200', meaning: '读取 / 幂等重放', when: 'GET 成功；重复提交命中幂等键' },
    { code: '201', meaning: '创建成功', when: 'POST 新建实体，返回实体与 Location 语义' },
    { code: '400', meaning: '请求非法', when: '字段缺失、类型错误、超长' },
    { code: '404', meaning: '资源不存在', when: 'id 不存在或已被删除' },
    { code: '409', meaning: '状态冲突', when: '非法状态流转、版本号过期' },
];

const checklist = [
    '每个 handler 只处理一个方法；同一路径的 GET / POST / DELETE 拆成独立文件。',
    '入参在服务端二次校验：共享类型只解决编译期，不解决运行时。',
    '写接口返回完整实体，读接口返回稳定结构；不要在不同页面返回不同字段集。',
    '幂等键、事务与审计是同一套写路径的一部分，不要分散在多个 handler 里。',
    '内存存储只用于演示；生产必须换持久化存储并验证并发与故障恢复。',
];
</script>

<template>
    <DocPage
        title="全栈数据层"
        description="Nitro 把服务端收进了同一个进程：文件即接口，类型跨前后端共享。真正的难点不是写 CRUD，而是在写路径上保证一致性、幂等与可追溯。"
        :tags="['Nitro', 'REST 契约', 'useStorage', '事务', '幂等', '审计']"
    >
        <DocSection id="nitro" title="Nitro 服务端模型" kicker="01 · NITRO">
            <p class="body-text">
                Nuxt 4 的 <code>server/</code> 由 Nitro 编译成独立产物：开发时与 Vite 同进程，
                生产时是一个可部署到 Node / Docker / Serverless 的处理器。
                文件名决定 URL 与方法，<code>server/utils/</code> 下的函数自动导入到 handler。
            </p>
            <CodeBlock :code="SERVER_TREE" lang="text" title="server 目录 → 接口" />
            <Callout type="tip" title="handler 保持薄">
                handler 只做三件事：读参数、校验、调用领域函数。业务逻辑放进
                <code>server/utils/</code>，这样同一段逻辑能被多个路由复用，也能被集成测试直接调用。
            </Callout>
        </DocSection>

        <DocSection id="rest" title="REST 契约：状态码即协议" kicker="02 · CONTRACT">
            <p class="body-text">
                前后端最容易腐化的地方不是字段名，而是状态码与错误体。
                把状态码当成协议的一部分，客户端才能写出确定的分支，而不是靠字符串匹配。
            </p>
            <CodeBlock :code="CONTRACT_CODE" lang="ts" title="创建接口的契约" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>状态码</th><th>语义</th><th>触发场景</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in statusTable" :key="row.code">
                            <td class="mono">{{ row.code }}</td>
                            <td>{{ row.meaning }}</td>
                            <td>{{ row.when }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="storage" title="存储选型" kicker="03 · STORAGE">
            <p class="body-text">
                选存储先看访问模式：是否需要索引、是否需要事务、是否需要 TTL。
                本项目的 CRUD 演示使用 Nitro 的 <code>useStorage</code>，
                它把底层驱动抽象成 key-value，开发期落盘、生产可切 Redis 或 S3。
            </p>
            <CodeBlock :code="STORAGE_CODE" lang="ts" title="useStorage 的命名空间与 key" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>存储</th><th>适合</th><th>优点</th><th>边界</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in storageOptions" :key="row.type">
                            <td class="mono">{{ row.type }}</td>
                            <td>{{ row.fit }}</td>
                            <td>{{ row.pros }}</td>
                            <td>{{ row.limit }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <Callout type="warn" title="KV 不是数据库">
                本模块的 <code>kv-api</code> 页面为了可运行，用「读全量 → 改内存 → 写全量」实现。
                并发写入会互相覆盖，删除也不具备原子性。真实业务需要数据库或带 CAS 的存储。
            </Callout>
        </DocSection>

        <DocSection id="consistency" title="事务 / 幂等 / 审计总览" kicker="04 · WRITE PATH">
            <p class="body-text">
                所有写操作都走同一条路径：先鉴权，再幂等，再事务，最后审计。
                顺序不能反：先做业务再查幂等键，重放时就会产生第二笔数据。
            </p>
            <CodeBlock :code="WRITE_PATH_CODE" lang="ts" title="写路径的三道保险" />
            <ul class="checklist">
                <li v-for="item in checklist" :key="item">{{ item }}</li>
            </ul>
        </DocSection>

        <DocSection id="pages" title="本模块阅读路径" kicker="05 · NEXT">
            <div class="route-grid">
                <NuxtLink to="/fullstack/kv-api" class="route-card">
                    <p class="route-kicker">API 演示</p>
                    <h3>KV 存储 CRUD</h3>
                    <p>用 useStorage 完成增删查，配合正确状态码与共享类型。</p>
                </NuxtLink>
                <NuxtLink to="/fullstack/enterprise" class="route-card">
                    <p class="route-kicker">LIVE 演示</p>
                    <h3>企业级综合场景</h3>
                    <p>订单状态机、幂等重放、409 冲突与审计日志。</p>
                </NuxtLink>
                <NuxtLink to="/fullstack/transactions" class="route-card">
                    <p class="route-kicker">参考</p>
                    <h3>事务与并发</h3>
                    <p>隔离级别、乐观锁、防超卖、Outbox 与 N+1。</p>
                </NuxtLink>
            </div>
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

.route-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
}

.route-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    transition: border-color 150ms ease, transform 150ms ease;
}

.route-card:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
}

.route-kicker {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
}

.route-card h3 {
    margin: 2px 0 4px;
    font-size: 16px;
}

.route-card p:last-child {
    margin: 0;
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-muted);
}
</style>
