<script setup lang="ts">
// 游乐场：一页演示组件、composable、Pinia 三种状态玩法
useSeoMeta({ title: '游乐场 - Nuxt LearnHub' });

// 1. 组件 v-model 演示
const boxValue = ref(0);

// 2. composable 演示（useState 跨组件共享）
const { count, increment, decrement, reset } = useCounter();

// 3. Pinia store 演示（storeToRefs 解构保持响应式）
const counterStore = useCounterStore();
const { count: storeCount, double } = storeToRefs(counterStore);

// 运行时配置与应用配置演示
const config = useRuntimeConfig();
const appConfig = useAppConfig();
</script>

<template>
    <section class="playground">
        <h1>游乐场</h1>

        <!-- 组件：props + emits -->
        <CounterBox v-model="boxValue" />
        <p class="tip">父组件中的值：{{ boxValue }}</p>

        <!-- 组合式函数：useCounter -->
        <div class="card">
            <h4>组合式函数演示：useCounter（useState）</h4>
            <div class="counter-row">
                <button class="btn btn--ghost" @click="decrement()">-1</button>
                <span class="counter-value">{{ count }}</span>
                <button class="btn btn--ghost" @click="increment()">+1</button>
                <button class="btn btn--ghost" @click="reset()">重置</button>
            </div>
        </div>

        <!-- Pinia：counter store -->
        <div class="card">
            <h4>Pinia 演示：counter store</h4>
            <div class="counter-row">
                <span class="counter-value">{{ storeCount }}</span>
                <span>双倍：{{ double }}</span>
                <button class="btn btn--ghost" @click="counterStore.increment()">+1</button>
            </div>
        </div>

        <!-- 配置读取 -->
        <div class="card">
            <h4>配置读取</h4>
            <p>站点名（useRuntimeConfig().public.siteName）：{{ config.public.siteName }}</p>
            <p>主题色（useAppConfig().theme.primary）：{{ appConfig.theme.primary }}</p>
        </div>
    </section>
</template>

<style scoped>
.playground {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.playground h4 {
    margin: 0 0 12px;
}

.counter-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

.counter-value {
    min-width: 40px;
    text-align: center;
    font-size: 20px;
    font-weight: 700;
}

.tip {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 14px;
}
</style>
