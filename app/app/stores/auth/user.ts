import type { AuthState, AuthUser, LoginInput, LoginResponse } from '#shared/types/auth';

// Setup 风格 store：登录用户信息
export const useUserStore = defineStore('user', () => {
    const user = ref<AuthUser | null>(null);

    // 拉取当前登录用户（SSR 下转发浏览器 cookie）
    async function fetchMe(): Promise<AuthUser | null> {
        const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined;
        const data = await $fetch<AuthState>('/api/auth/me', { headers });
        user.value = data.user;
        return data.user;
    }

    // 登录
    async function login(username: string, password: string): Promise<AuthUser> {
        const body: LoginInput = { username, password };
        const data = await $fetch<LoginResponse>('/api/auth/login', { method: 'POST', body });
        user.value = data.user;
        return data.user;
    }

    // 退出登录
    async function logout(): Promise<void> {
        await $fetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
        user.value = null;
    }

    return { user, fetchMe, login, logout };
});
