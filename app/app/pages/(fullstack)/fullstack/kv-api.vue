<script setup lang="ts">
import type { FullstackItem } from '#shared/types/fullstack-item';

definePageMeta({ layout: 'docs' });

const { data: items, status, refresh } = await useFetch<FullstackItem[]>('/api/fullstack/items', {
    key: 'fullstack-items',
});

const form = reactive({ title: '', note: '' });
const submitting = ref(false);
const deletingId = ref<number | null>(null);
const notice = ref('');
const errorText = ref('');

async function create() {
    errorText.value = '';
    notice.value = '';

    if (!form.title.trim()) {
        errorText.value = '标题不能为空';
        return;
    }

    submitting.value = true;
    try {
        const created = await $fetch<FullstackItem>('/api/fullstack/items', {
            method: 'POST',
            body: { title: form.title.trim(), note: form.note.trim() },
        });
        notice.value = `已创建 #${created.id}：${created.title}`;
        form.title = '';
        form.note = '';
        await refresh();
    } catch (error) {
        errorText.value = getApiErrorMessage(error);
    } finally {
        submitting.value = false;
    }
}

async function remove(item: FullstackItem) {
    errorText.value = '';
    notice.value = '';
    deletingId.value = item.id;

    try {
        await $fetch(`/api/fullstack/items/${item.id}`, { method: 'DELETE' });
        notice.value = `已删除 #${item.id}：${item.title}`;
        await refresh();
    } catch (error) {
        errorText.value = getApiErrorMessage(error);
    } finally {
        deletingId.value = null;
    }
}

const TYPE_CODE = `// shared/types/fullstack-item.ts —— 前后端唯一事实来源
export interface FullstackItem {
    id: number;
    title: string;
    note: string;
    done: boolean;
    createdAt: string;
}

export interface FullstackItemInput {
    title: string;
    note?: string;
    done?: boolean;
}`;

const HANDLERS_CODE = `// server/api/fullstack/items/index.get.ts
export default defineEventHandler(() => listItems());

// server/api/fullstack/items/index.post.ts
export default defineEventHandler(async (event) => {
    const body = await readBody<Partial<FullstackItemInput>>(event);
    const title = String(body?.title ?? '').trim();
    if (!title) throw createError({ statusCode: 400, message: '标题不能为空' });
    if (title.length > 80) throw createError({ statusCode: 400, message: '标题超长' });

    const item = await createItem({ title, note: body?.note ?? '' });
    setResponseStatus(event, 201);
    return item;
});

// server/api/fullstack/items/[id].delete.ts
export default defineEventHandler(async (event) => {
    const id = Number(getRouterParam(event, 'id'));
    if (!Number.isInteger(id) || id <= 0) {
        throw createError({ statusCode: 400, message: '非法的条目 id' });
    }
    const removed = await removeItem(id);
    if (!removed) throw createError({ statusCode: 404, message: '条目不存在' });
    return { ok: true, id };
});`;

const STORE_CODE = `// server/utils/fullstack/item-store.ts —— 命名空间 data 下的单个 key
const KEY = 'fullstack-items';

async function readAll(): Promise<FullstackItem[]> {
    const storage = useStorage<FullstackItem[]>('data');
    const stored = await storage.getItem(KEY);
    if (!stored) {
        await storage.setItem(KEY, [...seedItems]);
        return [...seedItems];
    }
    return stored;
}

async function writeAll(items: FullstackItem[]): Promise<void> {
    const storage = useStorage<FullstackItem[]>('data');
    await storage.setItem(KEY, items);
}`;

const REQUEST_CODE = `// 读：useFetch 绑定 key，页面刷新时复用同一份缓存
const { data, status, refresh } = await useFetch<FullstackItem[]>(
    '/api/fullstack/items',
    { key: 'fullstack-items' },
);

// 写：$fetch 返回完整实体，随后 refresh 同一 key
const created = await $fetch<FullstackItem>('/api/fullstack/items', {
    method: 'POST',
    body: { title: '新的条目', note: '说明' },
});
await refresh();

// 删除：路径参数即资源标识
await $fetch('/api/fullstack/items/' + created.id, { method: 'DELETE' });`;

const limits = [
    '当前实现是全量读写：任何一次写入都会覆盖整个数组，并发时会丢更新。',
    '没有索引与分页：条目数超过几百条后，列表接口应改为分页 + 服务端过滤。',
    '删除与创建不具备原子性：生产应使用数据库或带 CAS 的存储。',
    'KV 适合配置与演示；核心业务数据必须选带事务与约束的存储。',
    '多实例部署时 fs 驱动不可共享；把 driver 换成 Redis / S3 才能横向扩展。',
];
</script>

<template>
    <DocPage
        title="KV 存储 CRUD"
        description="用 Nitro 的 useStorage 完成一次真正可用的增删查：shared 类型约束契约，handler 负责校验与状态码，store 负责持久化。"
        :tags="['useStorage', 'KV', 'REST', '201 / 400 / 404', '$fetch']"
    >
        <DocSection id="model" title="KV 存储模型" kicker="01 · MODEL">
            <p class="body-text">
                <code>useStorage('data')</code> 读取 <code>nuxt.config.ts</code> 中声明的
                <code>data</code> 命名空间，开发期用 fs 驱动落盘到 <code>.data/kv</code>。
                本模块用单个 key <code>fullstack-items</code> 保存整个数组——
                简单、直观，但只适合条目量很小的场景。
            </p>
            <CodeBlock :code="STORE_CODE" lang="ts" title="server/utils/fullstack/item-store.ts" />
            <Callout type="info" title="key 的命名">
                命名空间已经隔离了驱动层面，key 仍然要带业务前缀（<code>fullstack-items</code>）。
                多个模块共用一个命名空间时，前缀是避免撞车的最后一道防线。
            </Callout>
        </DocSection>

        <DocSection id="api" title="三个 handler" kicker="02 · API">
            <p class="body-text">
                列表、创建、删除拆成三个文件。创建成功返回 <code>201</code>；
                标题为空返回 <code>400</code>；删除不存在的 id 返回 <code>404</code>。
                状态码不是装饰，它决定了客户端能否写出确定的分支。
            </p>
            <CodeBlock :code="HANDLERS_CODE" lang="ts" title="GET / POST / DELETE" />
            <CodeBlock :code="TYPE_CODE" lang="ts" title="shared/types/fullstack-item.ts" />
        </DocSection>

        <DocSection id="client" title="客户端读写与刷新" kicker="03 · CLIENT">
            <p class="body-text">
                查询用 <code>useFetch</code> 并显式给 <code>key</code>，
                写入用 <code>$fetch</code>，成功后只刷新同一个 key。
                这样页面不会因为一次创建而重新拉取无关数据。
            </p>
            <CodeBlock :code="REQUEST_CODE" lang="ts" title="读 / 写 / 刷新" />
        </DocSection>

        <DocSection id="demo" title="增删查完整演示" kicker="04 · LIVE">
            <p class="body-text">
                下面的表单直接调用真实接口。创建成功后列表会刷新并可立即删除；
                若提交空标题，服务端会返回 <code>400</code>，前端展示归一化后的错误文案。
            </p>
            <DemoCard
                title="KV 条目管理"
                desc="POST 创建 → useFetch 列表 refresh → DELETE 删除，全部走 /api/fullstack/items。"
                badge="API"
            >
                <form class="item-form" @submit.prevent="create">
                    <input
                        v-model="form.title"
                        class="input"
                        type="text"
                        placeholder="标题（必填），如：幂等键设计"
                    />
                    <input
                        v-model="form.note"
                        class="input"
                        type="text"
                        placeholder="备注（可选）"
                    />
                    <div class="form-row">
                        <button class="btn" type="submit" :disabled="submitting">
                            {{ submitting ? '提交中……' : 'POST /api/fullstack/items' }}
                        </button>
                        <span class="form-hint mono">
                            {{ status === 'pending' ? '刷新中' : `共 ${items?.length ?? 0} 条` }}
                        </span>
                    </div>
                </form>

                <p v-if="errorText" class="demo-error">{{ errorText }}</p>
                <p v-else-if="notice" class="demo-notice">{{ notice }}</p>

                <ul v-if="items?.length" class="item-list">
                    <li v-for="item in items" :key="item.id" class="item-row">
                        <span class="item-id mono">#{{ item.id }}</span>
                        <div class="item-main">
                            <p class="item-title">{{ item.title }}</p>
                            <p class="item-note">{{ item.note || '（无备注）' }}</p>
                        </div>
                        <span v-if="item.done" class="badge badge--accent">done</span>
                        <button
                            class="btn btn--danger btn--sm"
                            type="button"
                            :disabled="deletingId === item.id"
                            @click="remove(item)"
                        >
                            {{ deletingId === item.id ? '删除中' : '删除' }}
                        </button>
                    </li>
                </ul>
                <p v-else class="empty">列表为空：先创建一条，再删除它。</p>

                <template #footer>
                    数据存放在服务端 <code>data:fullstack-items</code>；刷新页面不会丢失，重启 dev 服务仍会保留。
                </template>
            </DemoCard>
        </DocSection>

        <DocSection id="limits" title="边界与升级路径" kicker="05 · LIMITS">
            <ul class="checklist">
                <li v-for="item in limits" :key="item">{{ item }}</li>
            </ul>
            <p class="body-text next">
                下一节进入真实业务：订单状态机、幂等键与审计日志都在同一个写路径上完成。
                <NuxtLink to="/fullstack/enterprise" class="inline-link">继续阅读「企业级综合场景」→</NuxtLink>
            </p>
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

.item-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.form-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.form-hint {
    font-size: 12px;
    color: var(--text-muted);
}

.demo-error,
.demo-notice {
    margin: 12px 0 0;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    font-size: 13px;
}

.demo-error {
    border: 1px solid var(--danger);
    background: rgba(248, 113, 113, 0.1);
    color: var(--danger);
}

.demo-notice {
    border: 1px solid var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
}

.item-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 14px 0 0;
    padding: 0;
    list-style: none;
}

.item-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
}

.item-id {
    color: var(--accent);
    font-size: 11px;
}

.item-main {
    flex: 1;
    min-width: 0;
}

.item-title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
}

.item-note {
    margin: 2px 0 0;
    font-size: 11px;
    color: var(--text-muted);
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

.next {
    margin-top: 16px;
}

.inline-link {
    color: var(--accent);
    border-bottom: 1px dashed var(--accent);
}
</style>
