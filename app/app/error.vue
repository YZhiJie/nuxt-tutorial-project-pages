<script setup lang="ts">
// 全局错误页：统一展示状态码、错误信息与恢复入口
const error = useError();
const route = useRoute();

const statusCode = computed(() => error.value?.statusCode ?? 500);
const message = computed(() => {
    const msg = error.value?.message;
    if (!msg) return '页面出错了';
    return msg.startsWith('[') ? msg : msg;
});
</script>

<template>
    <div class="error-page">
        <div class="error-panel">
            <p class="eyebrow">ERROR / {{ statusCode }}</p>
            <h1>{{ statusCode === 404 ? '页面走丢了' : '请求未能完成' }}</h1>
            <p class="error-message">{{ message }}</p>
            <p class="error-path mono">{{ route.fullPath }}</p>
            <div class="error-actions">
                <button class="btn" @click="clearError({ redirect: '/' })">返回首页</button>
                <NuxtLink class="btn btn--ghost" to="/#modules">浏览模块</NuxtLink>
            </div>
        </div>
    </div>
</template>

<style scoped>
.error-page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
}

.error-panel {
    width: min(520px, 100%);
    padding: 40px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow);
    text-align: center;
}

.error-panel h1 {
    margin: 10px 0 8px;
    font-size: 30px;
}

.error-message {
    margin: 0 0 8px;
    color: var(--text-muted);
}

.error-path {
    margin: 0 0 24px;
    font-size: 12px;
    color: var(--text-faint);
    word-break: break-all;
}

.error-actions {
    display: flex;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
}
</style>
