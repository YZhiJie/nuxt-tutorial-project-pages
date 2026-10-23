// 封装带统一错误处理的 $fetch 实例，通过 $api 注入全局
export default defineNuxtPlugin(() => {
    const api = $fetch.create({
        baseURL: '/api',
        onResponseError({ response }) {
            console.error(`[api] 请求失败：${response.status} ${response.statusText}`);
        },
    });
    return {
        provide: {
            api,
        },
    };
});
