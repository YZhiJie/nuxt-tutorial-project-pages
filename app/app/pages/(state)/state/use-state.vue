<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const { count, increment, decrement, reset } = useCounter();

const USE_STATE_CODE = `// app/composables/lab/useCounter.ts
export function useCounter() {
    const count = useState('playground-counter', () => 0);

    const increment = () => { count.value += 1; };
    const decrement = () => { count.value -= 1; };
    const reset = () => { count.value = 0; };

    return { count, increment, decrement, reset };
}

// 任意组件调用都拿到同一个 ref，读写即时同步
const { count, increment } = useCounter();`;

const SSR_CODE = `// ① 服务端初始化并修改状态
const count = useState('playground-counter', () => 0);
count.value = 3;

// ② 状态随 payload 下发，客户端水合后仍是 3
// ③ 不要在模块顶层用普通 ref 模拟跨组件单例：
//    服务端请求之间共享同一实例，会串数据
const leaked = ref(0); // ❌ 模块级单例`;

const KEY_CODE = `// ✅ 命名空间 + 业务语义，全局唯一
useState('docs:search-keyword', () => '');
useState('lab:counter', () => 0);

// ❌ 每个组件调用时生成新 key，无法共享
useState(\`counter:\${Math.random()}\`, () => 0);

// ❌ 同名 key 出现在两个业务域，后写入者覆盖先写入者
useState('keyword', () => '');`;

const RESET_CODE = `// ① 业务上重置：调用 composable 暴露的 reset
const { reset } = useCounter();
reset();

// ② 组件卸载 / 页面切换后清空全局状态
onBeforeUnmount(() => {
    clearNuxtState('playground-counter');
});

// ③ 只在需要时清空：clearNuxtState 会影响所有使用该 key 的组件
// clearNuxtState('docs:search-keyword');`;

const rules = [
    'useState 的初始化函数只在服务端 / 客户端首次创建时执行一次，适合放默认值。',
    '状态对象不要跨请求复用；模块级单例在 SSR 下会被多个请求共享。',
    'key 使用「业务域:语义」格式，避免不同模块撞名。',
    '需要时间旅行、订阅与领域规则时，把状态迁移到 Pinia。',
];
</script>

<template>
    <DocPage
        title="useState 与共享状态"
        description="useState 是 Nuxt 提供的 SSR 安全全局 ref：写法接近 ref，但能随 payload 同构。下面用现有 useCounter() 演示跨组件共享与重置。"
        :tags="['useState', 'SSR 安全', '共享状态', 'clearNuxtState', 'useCounter']"
    >
        <DocSection id="concept" title="useState 的本质" kicker="01 · CONCEPT">
            <p class="body-text">
                <code>useState(key, init)</code> 返回一个 <code>Ref</code>，
                相同 key 在任意组件中拿到同一个实例。它由 Nuxt 的请求上下文托管：
                服务端设置的值会序列化进 payload，客户端水合后继续复用。
            </p>
            <CodeBlock :code="USE_STATE_CODE" lang="ts" title="app/composables/lab/useCounter.ts" />
            <Callout type="tip" title="useState 不是 Pinia 的替代品">
                useState 只解决“同一个 key 的共享引用”，没有 action、getter、订阅与 devtools。
                状态一旦有领域规则，就应该迁移到 Pinia。
            </Callout>
        </DocSection>

        <DocSection id="demo" title="共享计数器" kicker="02 · LIVE SHARED">
            <p class="body-text">
                当前页面调用的就是 <code>useCounter()</code>。如果另一个组件（例如
                <code>/playground</code>）同时调用它，两处读写的是同一个
                <code>playground-counter</code>。刷新页面后计数归零，因为它在服务端重新初始化。
            </p>
            <DemoCard title="useCounter 跨组件共享" desc="key = playground-counter；三个动作都直接修改同一个 ref。" badge="LIVE">
                <div class="counter-row">
                    <button type="button" class="btn btn--ghost" @click="decrement()">-1</button>
                    <span class="counter-value">{{ count }}</span>
                    <button type="button" class="btn btn--ghost" @click="increment()">+1</button>
                    <button type="button" class="btn btn--sm" @click="reset()">重置</button>
                </div>
                <p class="counter-hint">
                    当前值：<code>count = {{ count }}</code>；所有使用同一 key 的组件会立即同步。
                </p>
            </DemoCard>
        </DocSection>

        <DocSection id="ssr" title="SSR 安全与状态重置" kicker="03 · SSR SAFETY">
            <p class="body-text">
                SSR 下每个请求都有独立上下文。普通模块级 <code>ref</code> 会在请求之间共享，
                而 <code>useState</code> 绑定到当前请求，因此不会串数据。
            </p>
            <CodeBlock :code="SSR_CODE" lang="ts" title="请求级隔离" />
            <CodeBlock :code="RESET_CODE" lang="ts" title="两种重置方式" />
        </DocSection>

        <DocSection id="key" title="key 的唯一性" kicker="04 · KEY">
            <p class="body-text">
                key 冲突不会报错，只会让两个无关模块悄悄共享同一份状态。
                统一使用「业务域:语义」命名，并在 code review 中检查重复 key。
            </p>
            <CodeBlock :code="KEY_CODE" lang="ts" title="key 命名规范" />
            <ul class="checklist">
                <li v-for="item in rules" :key="item">{{ item }}</li>
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

.counter-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
}

.counter-value {
    min-width: 56px;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 28px;
    font-weight: 700;
    color: var(--accent);
}

.counter-hint {
    margin: 16px 0 0;
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
