// 当前登录用户：根据会话 cookie 判断
export default defineEventHandler((event) => {
    const session = getCookie(event, 'session');
    return session === 'demo-token' ? { user: { name: 'demo' } } : { user: null };
});
