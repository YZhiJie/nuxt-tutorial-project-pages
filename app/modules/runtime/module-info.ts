interface LearnHubToolkitRuntimeConfig {
    name: string;
    version: string;
    buildTime: string;
}

/**
 * 模块注册的接口：返回模块版本、构建时间与当前请求 id。
 * handler 位于模块目录下，通过 addServerHandler 注册，
 * 因此不需要放在 server/api 里。
 */
export default defineEventHandler((event) => {
    const config = useRuntimeConfig();
    const toolkit = config.learnhubToolkit as LearnHubToolkitRuntimeConfig;

    // 模块信息随构建变化，不能让 CDN 缓存成旧版本
    setResponseHeader(event, 'cache-control', 'no-store');

    return {
        module: toolkit,
        requestId: (event.context.requestId as string | undefined) ?? null,
        at: new Date().toISOString(),
    };
});
