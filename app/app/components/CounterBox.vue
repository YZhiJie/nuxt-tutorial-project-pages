<script setup lang="ts">
// 计数器组件：演示 props 输入 + emits 输出（配合 v-model 使用）
defineProps<{ modelValue: number }>();
const emit = defineEmits<{ 'update:modelValue': [value: number] }>();
</script>

<template>
    <div class="card">
        <h4 class="counter-title">组件演示：CounterBox（props + emits）</h4>
        <div class="counter-row">
            <button class="btn btn--ghost" @click="emit('update:modelValue', modelValue - 1)">-1</button>
            <span class="counter-value">{{ modelValue }}</span>
            <button class="btn btn--ghost" @click="emit('update:modelValue', modelValue + 1)">+1</button>
        </div>
    </div>
</template>

<style scoped>
.counter-title {
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
</style>
