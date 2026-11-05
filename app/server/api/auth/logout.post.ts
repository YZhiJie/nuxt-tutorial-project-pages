// 退出登录：写接口统一走 toApiError，保证异常时也是 { error: { code, ... } } 信封
export default defineEventHandler((event) => {
    try {
        clearAuthSession(event);
        return { ok: true };
    } catch (error) {
        throw toApiError(event, error);
    }
});
