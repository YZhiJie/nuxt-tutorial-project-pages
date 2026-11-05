import type { AuthUser } from '#shared/types/auth';

// 登录态组合式函数：统一收口 user store 的读写
export function useAuth() {
    const store = useUserStore();
    const user = computed<AuthUser | null>(() => store.user);

    return {
        user,
        fetchMe: () => store.fetchMe(),
        login: (username: string, password: string) => store.login(username, password),
        logout: () => store.logout(),
    };
}
