// .client 后缀：仅在客户端执行的插件
export default defineNuxtPlugin(() => {
    console.log('[plugin] 你好，客户端插件已启动！');
});
