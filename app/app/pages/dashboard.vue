<script setup lang="ts">
// 控制台：受 auth 中间件保护，未登录会被重定向到 /login
definePageMeta({ middleware: 'auth' });

const { data, refresh } = await useFetch('/api/auth/me');

// 退出登录：清掉服务端 cookie，刷新状态后回首页
async function onLogout() {
    await $fetch('/api/auth/logout', { method: 'POST' });
    await refresh();
    await navigateTo('/');
}
</script>

<template>
    <section class="card">
        <h1>控制台</h1>
        <p>当前登录用户：<strong>{{ data?.user?.name }}</strong></p>
        <button class="btn btn--danger" @click="onLogout">退出登录</button>
    </section>
</template>
