<script setup lang="ts">
// 全局错误页：useError 获取当前错误对象
const error = useError();
</script>

<template>
    <div class="error-page">
        <div class="card error-card">
            <h1 class="error-code">{{ error?.statusCode ?? 500 }}</h1>
            <p class="error-message">{{ error?.message ?? '页面出错了' }}</p>
            <!-- 清除错误并跳转回首页 -->
            <button class="btn" @click="clearError({ redirect: '/' })">返回首页</button>
        </div>
    </div>
</template>

<style scoped>
.error-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
}

.error-card {
    text-align: center;
    padding: 48px 64px;
}

.error-code {
    font-size: 48px;
    margin: 0 0 8px;
    color: var(--color-primary-dark);
}

.error-message {
    color: var(--color-text-muted);
    margin: 0 0 24px;
}
</style>
