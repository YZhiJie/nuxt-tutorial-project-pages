import type { AuthState } from '#shared/types/auth';

// 当前登录用户：根据会话 cookie 判断
export default defineEventHandler((event): AuthState => {
    return { user: getSessionUser(event) };
});
