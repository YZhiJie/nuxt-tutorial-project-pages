// 全局路由中间件：记录每次路由跳转（仅客户端输出，避免污染服务端日志）
export default defineNuxtRouteMiddleware((to, from) => {
    if (import.meta.client) {
        console.log(`[router] ${from.fullPath} → ${to.fullPath}`);
    }
});
