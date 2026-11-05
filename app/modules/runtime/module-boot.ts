interface LearnHubToolkitRuntimeConfig {
    name: string;
    version: string;
    buildTime: string;
}

/**
 * Nitro 启动插件：每个服务进程启动时执行一次。
 * 用来验证模块的 addServerPlugin 与 runtimeConfig 注入是否生效。
 */
export default defineNitroPlugin(() => {
    const toolkit = useRuntimeConfig().learnhubToolkit as LearnHubToolkitRuntimeConfig;
    console.info(
        `[learnhub-toolkit] ready ${toolkit.name}@${toolkit.version} (built ${toolkit.buildTime})`,
    );
});
