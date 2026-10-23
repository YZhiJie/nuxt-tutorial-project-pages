<script setup lang="ts">
// 顶部导航：站点名 + 页面链接 + 登录状态
const { data } = useFetch('/api/auth/me');
const appConfig = useAppConfig();

// 当前登录用户名（未登录为空字符串）
const userName = computed(() => data.value?.user?.name ?? '');
</script>

<template>
    <header class="site-header">
        <div class="container header-inner">
            <NuxtLink to="/" class="site-title">{{ appConfig.title }}</NuxtLink>
            <nav class="site-nav">
                <NuxtLink to="/">首页</NuxtLink>
                <NuxtLink to="/notes">笔记</NuxtLink>
                <NuxtLink to="/playground">游乐场</NuxtLink>
                <NuxtLink to="/about">关于</NuxtLink>
                <NuxtLink to="/admin">后台</NuxtLink>
            </nav>
            <div class="header-user">
                <!-- 已登录：用户名 + 控制台入口 -->
                <template v-if="userName">
                    <span class="user-name">{{ userName }}</span>
                    <NuxtLink class="btn" to="/dashboard">控制台</NuxtLink>
                </template>
                <!-- 未登录：登录链接 -->
                <NuxtLink v-else class="btn btn--ghost" to="/login">登录</NuxtLink>
            </div>
        </div>
    </header>
</template>

<style scoped>
.site-header {
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
}

.header-inner {
    display: flex;
    align-items: center;
    gap: 24px;
    height: 56px;
}

.site-title {
    font-weight: 700;
    color: var(--color-primary-dark);
}

.site-nav {
    display: flex;
    gap: 16px;
    flex: 1;
}

.site-nav a.router-link-active {
    color: var(--color-primary-dark);
    font-weight: 600;
}

.header-user {
    display: flex;
    align-items: center;
    gap: 10px;
}

.user-name {
    color: var(--color-text-muted);
    font-size: 14px;
}
</style>
