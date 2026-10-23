// Setup 风格 store：登录用户信息
export const useUserStore = defineStore('user', () => {
    const user = ref<{ name: string } | null>(null);

    // 拉取当前登录用户
    async function fetchMe() {
        const data = await $fetch<{ user: { name: string } | null }>('/api/auth/me');
        user.value = data.user;
    }

    // 登录
    async function login(username: string, password: string) {
        const data = await $fetch<{ user: { name: string } }>('/api/auth/login', {
            method: 'POST',
            body: { username, password },
        });
        user.value = data.user;
    }

    // 退出登录
    async function logout() {
        await $fetch('/api/auth/logout', { method: 'POST' });
        user.value = null;
    }

    return { user, fetchMe, login, logout };
});
