// 退出登录：清除会话 cookie
export default defineEventHandler((event) => {
    deleteCookie(event, 'session');
    return { ok: true };
});
