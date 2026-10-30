// 具名路由中间件：保护需要登录的页面
export default defineNuxtRouteMiddleware(async () => {
    const { fetchMe } = useAuth();
    await fetchMe();
    // 未登录则跳转到登录页
    if (!useUserStore().user) {
        return navigateTo('/login');
    }
});
