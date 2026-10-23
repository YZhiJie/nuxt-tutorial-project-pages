// 具名路由中间件：保护需要登录的页面
export default defineNuxtRouteMiddleware(async () => {
    const { data } = await useFetch('/api/auth/me');
    // 未登录则跳转到登录页
    if (!data.value?.user) {
        return navigateTo('/login');
    }
});
