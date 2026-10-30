// 退出登录：清除会话 cookie
export default defineEventHandler((event) => {
    clearAuthSession(event);
    return { ok: true };
});
