// Nitro 服务端中间件：记录每个请求的方法、路径与耗时
export default defineEventHandler((event) => {
    const start = Date.now();
    event.node.res.on('finish', () => {
        console.log(`[server] ${event.node.req.method} ${event.path} - ${Date.now() - start}ms`);
    });
});
