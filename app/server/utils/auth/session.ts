import type { H3Event } from 'h3';
import type { AuthUser } from '#shared/types/auth';

const SESSION_COOKIE = 'session';
const SESSION_TOKEN = 'demo-token';

export const demoUser: AuthUser = { name: 'demo' };

// 读取当前会话用户
export function getSessionUser(event: H3Event): AuthUser | null {
    return getCookie(event, SESSION_COOKIE) === SESSION_TOKEN ? demoUser : null;
}

// 要求登录：未登录直接 401，供受保护的接口使用
export function requireSessionUser(event: H3Event): AuthUser {
    const user = getSessionUser(event);
    if (!user) {
        throw createError({ statusCode: 401, message: '请先登录' });
    }
    return user;
}

// 写入演示会话 cookie
export function setAuthSession(event: H3Event): AuthUser {
    setCookie(event, SESSION_COOKIE, SESSION_TOKEN, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24,
    });
    return demoUser;
}

// 清除会话 cookie
export function clearAuthSession(event: H3Event): void {
    deleteCookie(event, SESSION_COOKIE);
}
