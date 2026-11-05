// 服务端接口守卫：/api/admin/** 必须登录
export default defineEventHandler((event) => {
    const path = getRequestURL(event).pathname;
    if (path.startsWith('/api/admin/')) {
        try {
            requireSessionUser(event);
        } catch (error) {
            // 中间件与 handler 共用同一错误信封，避免 401 返回默认纯文本结构
            throw toApiError(event, error);
        }
    }
});
