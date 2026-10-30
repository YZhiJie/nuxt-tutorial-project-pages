<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const counterStore = useCounterStore();
const { count, double } = storeToRefs(counterStore);

const OPTIONS_CODE = `// app/stores/lab/counter.ts —— Project 中现有的 Options 风格 store
export const useCounterStore = defineStore('counter', {
    state: () => ({ count: 0 }),
    getters: {
        double: (state) => state.count * 2,
    },
    actions: {
        increment() {
            this.count += 1;
        },
    },
});

// 组件中使用
const store = useCounterStore();
const { count, double } = storeToRefs(store);
store.increment();`;

const SETUP_CODE = `// Setup 风格：更接近组合式函数，类型推导更自然
export const useCartStore = defineStore('cart', () => {
    const items = ref<CartItem[]>([]);
    const total = computed(() => items.value.reduce((sum, item) => sum + item.price, 0));

    function add(item: CartItem) {
        items.value.push(item);
    }

    function clear() {
        items.value = [];
    }

    return { items, total, add, clear };
});

// 使用时同样用 storeToRefs 解构状态
const cart = useCartStore();
const { items, total } = storeToRefs(cart);
cart.add(product);`;

const REF_CODE = `const store = useCounterStore();

// ❌ 直接解构：count / double 变成一次性快照，不再响应
const { count, double } = store;

// ✅ storeToRefs：只转换状态与 getter，动作仍从 store 调用
const { count, double } = storeToRefs(store);
store.increment();

// ✅ 也可以不解构，直接访问（模板中会自动解包）
store.count;`;

const DOMAIN_CODE = `// 按业务域拆分 store，而不是一个巨大的全局 store
app/stores/
├── auth/user.ts        → 会话与用户
├── lab/counter.ts      → 演示计数器
└── cart/index.ts       → 购物车领域

// 每个 store 只负责自己的领域状态与动作
// 跨领域协作通过动作调用或页面组合，而不是互相 import 状态`;

const SSR_CODE = `// SSR 下 Pinia 实例按请求创建，服务端状态会序列化进水合 payload
// 不要在 store 初始化时直接读 window / localStorage
export const useUserStore = defineStore('user', () => {
    const theme = ref<'light' | 'dark'>('light'); // 默认值保持可序列化

    function hydrateFromClient() {
        if (import.meta.client) {
            theme.value = (localStorage.getItem('theme') as 'light' | 'dark') ?? 'light';
        }
    }

    return { theme, hydrateFromClient };
});`;

const points = [
    '状态尽量保持可序列化：函数、Map、class 实例不适合放进 state。',
    'getter 只做派生计算，不要在 getter 里发请求或修改其他状态。',
    '动作负责业务规则；组件只调用动作，不直接拼装跨 store 的写入。',
    'SSR 下避免在 store 创建阶段访问浏览器 API，放到 onMounted 或动作中。',
];
</script>

<template>
    <DocPage
        title="Pinia 领域 Store"
        description="Pinia 负责领域状态：状态、派生与动作集中管理。关键是按业务域拆分、正确解构，并在 SSR 下保持状态可序列化。"
        :tags="['Pinia', 'defineStore', 'storeToRefs', '领域拆分', 'SSR']"
    >
        <DocSection id="options" title="现有 Options Store" kicker="01 · OPTIONS">
            <p class="body-text">
                项目里的 <code>useCounterStore</code> 使用 Options 风格：
                <code>state</code> 描述数据，<code>getters</code> 描述派生，
                <code>actions</code> 描述变更。这类结构直观，适合状态字段较少的领域。
            </p>
            <CodeBlock :code="OPTIONS_CODE" lang="ts" title="app/stores/lab/counter.ts" />
        </DocSection>

        <DocSection id="demo" title="读取 count 与 double" kicker="02 · LIVE STORE">
            <p class="body-text">
                下面直接使用现有 store。按钮调用 <code>increment()</code>，
                页面上的 <code>count</code> 与派生 <code>double</code> 同步更新；
                <code>$reset()</code> 是 Options store 自带的复位动作。
            </p>
            <DemoCard title="Pinia counter store" desc="storeToRefs 解构 count / double，动作从 store 调用。" badge="LIVE">
                <div class="store-grid">
                    <div class="store-cell">
                        <span class="store-label">count</span>
                        <strong class="store-value">{{ count }}</strong>
                    </div>
                    <div class="store-cell">
                        <span class="store-label">double（getter）</span>
                        <strong class="store-value">{{ double }}</strong>
                    </div>
                </div>
                <div class="store-actions">
                    <button type="button" class="btn" @click="counterStore.increment()">increment() +1</button>
                    <button type="button" class="btn btn--ghost" @click="counterStore.$reset()">$reset()</button>
                </div>
                <p class="store-hint">
                    模板中也可直接写 <code>counterStore.count</code>，Vue 会自动解包。
                </p>
            </DemoCard>
        </DocSection>

        <DocSection id="setup" title="Setup 风格" kicker="03 · SETUP">
            <p class="body-text">
                Setup 风格把 store 写成组合式函数：<code>ref</code> 是 state，
                <code>computed</code> 是 getter，普通函数是 action。
                它更适合类型复杂、逻辑较多的领域。
            </p>
            <CodeBlock :code="SETUP_CODE" lang="ts" title="Setup store 示例" />
            <Callout type="info" title="两种风格可混用">
                同一个项目里两种写法可以共存。团队约定优先：小而简单的 store 用 Options，
                逻辑复杂的领域用 Setup。
            </Callout>
        </DocSection>

        <DocSection id="refs" title="storeToRefs 与领域拆分" kicker="04 · REFS">
            <p class="body-text">
                解构 store 时，状态与 getter 必须经过 <code>storeToRefs</code> 才能保持响应式；
                动作本身就是普通函数，直接从 store 调用即可。
            </p>
            <CodeBlock :code="REF_CODE" lang="ts" title="解构的正确姿势" />
            <CodeBlock :code="DOMAIN_CODE" lang="text" title="按业务域拆分" />
        </DocSection>

        <DocSection id="ssr" title="SSR 注意点" kicker="05 · SSR">
            <p class="body-text">
                Pinia 在 Nuxt 中按请求创建实例，服务端写入的状态会进入水合 payload。
                只要保持 state 可序列化、避免在创建阶段访问浏览器 API，SSR 就是安全的。
            </p>
            <CodeBlock :code="SSR_CODE" lang="ts" title="客户端专属逻辑的放置位置" />
            <ul class="checklist">
                <li v-for="item in points" :key="item">{{ item }}</li>
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

.store-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
}

.store-cell {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
}

.store-label {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-faint);
}

.store-value {
    font-family: var(--font-mono);
    font-size: 26px;
    color: var(--accent);
}

.store-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 14px;
}

.store-hint {
    margin: 14px 0 0;
    font-size: 13px;
    color: var(--text-muted);
}

.checklist {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 16px 0 0;
    padding: 0;
    list-style: none;
}

.checklist li {
    position: relative;
    padding-left: 24px;
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.7;
}

.checklist li::before {
    content: '→';
    position: absolute;
    left: 0;
    color: var(--accent);
    font-family: var(--font-mono);
}
</style>
