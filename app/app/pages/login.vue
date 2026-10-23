<script setup lang="ts">
// 登录页：使用空白布局（无导航）
definePageMeta({ layout: 'blank' });

const username = ref('');
const password = ref('');
const errorMessage = ref('');
const loading = ref(false);

async function onSubmit() {
    errorMessage.value = '';
    loading.value = true;
    try {
        await $fetch('/api/auth/login', {
            method: 'POST',
            body: { username: username.value, password: password.value },
        });
        // 登录成功进入控制台
        await navigateTo('/dashboard');
    } catch (e: any) {
        // 服务端返回的错误信息（如 401：账号或密码错误）
        errorMessage.value = e?.data?.statusMessage ?? '登录失败，请稍后重试';
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <div class="login-page">
        <form class="card login-card" @submit.prevent="onSubmit">
            <h1>登录</h1>
            <label class="login-field">
                账号
                <input
                    v-model="username"
                    class="input"
                    type="text"
                    placeholder="演示账号：demo"
                    autocomplete="username"
                />
            </label>
            <label class="login-field">
                密码
                <input
                    v-model="password"
                    class="input"
                    type="password"
                    placeholder="演示密码：nuxt1234"
                    autocomplete="current-password"
                />
            </label>
            <p v-if="errorMessage" class="login-error">{{ errorMessage }}</p>
            <button class="btn" type="submit" :disabled="loading">
                {{ loading ? '登录中……' : '登录' }}
            </button>
            <NuxtLink class="back-home" to="/">返回首页</NuxtLink>
        </form>
    </div>
</template>

<style scoped>
.login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
}

.login-card {
    width: 360px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.login-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 14px;
}

.login-error {
    margin: 0;
    color: #ef4444;
    font-size: 14px;
}

.back-home {
    text-align: center;
    color: var(--color-text-muted);
    font-size: 13px;
}
</style>
