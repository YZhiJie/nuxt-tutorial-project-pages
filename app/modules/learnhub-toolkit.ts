import {
    addServerHandler,
    addServerPlugin,
    addTemplate,
    createResolver,
    defineNuxtModule,
} from 'nuxt/kit';

/**
 * LearnHub 本地 Nuxt 模块（教程第 25 章的最小实验）。
 *
 * 职责：
 * 1. 把模块版本与构建时间写入 runtimeConfig，运行时可读；
 * 2. 注册一个服务端接口 /api/lab/module-info；
 * 3. 注册一个 Nitro 启动插件，打印模块就绪日志；
 * 4. 用 addTemplate 在构建目录生成 learnhub-toolkit.json，演示模板/文件生成。
 *
 * 本地模块放在 modules/ 下会被 Nuxt 自动扫描，无需在 nuxt.config.ts 的
 * modules 数组里手写路径。
 */
export interface LearnHubToolkitOptions {
    /** 接口前缀，默认 /api/lab */
    prefix: string;
    /** 开关：false 时模块完全不生效 */
    enabled: boolean;
}

const META = {
    name: 'learnhub-toolkit',
    version: '0.1.0',
} as const;

export default defineNuxtModule<LearnHubToolkitOptions>({
    meta: {
        name: META.name,
        configKey: 'learnhubToolkit',
        version: META.version,
    },
    defaults: {
        prefix: '/api/lab',
        enabled: true,
    },
    setup(options, nuxt) {
        if (!options.enabled) return;

        const { resolve } = createResolver(import.meta.url);
        const buildTime = new Date().toISOString();

        // 1) runtimeConfig：构建期写入，运行时通过 useRuntimeConfig() 读取
        (nuxt.options.runtimeConfig as Record<string, unknown>).learnhubToolkit = {
            ...META,
            buildTime,
        };

        // 2) addTemplate：把模块元信息落到构建目录（.nuxt/learnhub-toolkit.json）
        const metaTemplate = addTemplate({
            filename: 'learnhub-toolkit.json',
            // 默认只进虚拟文件系统；write: true 才会真正落盘，便于构建后核对
            write: true,
            getContents: () =>
                JSON.stringify({ ...META, buildTime }, null, 2),
        });

        // 3) 服务端接口：路由与 handler 文件由模块自己决定
        addServerHandler({
            route: `${options.prefix}/module-info`,
            handler: resolve('./runtime/module-info'),
        });

        // 4) Nitro 插件：进程启动时执行一次
        addServerPlugin(resolve('./runtime/module-boot'));

        // 5) 构建生命周期 hook：构建结束后把模板产物路径打到日志，便于排查
        nuxt.hook('build:done', () => {
            console.info(`[learnhub-toolkit] template written to ${metaTemplate.dst}`);
        });
    },
});
