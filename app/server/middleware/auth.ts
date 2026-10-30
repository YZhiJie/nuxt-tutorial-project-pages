// 服务端接口守卫：/api/admin/** 必须登录
export default defineEventHandler((event) => {
    const path = getRequestURL(event).pathname;
    if (path.startsWith('/api/admin/')) {
        requireSessionUser(event);
    }
});
