import { defineConfig } from 'vitest/config';

// 单测配置：只跑不依赖 Nuxt 运行时的纯函数测试。
// 集成测试（tests/integration）由 @nuxt/test-utils 单独启动构建产物服务，不在此统计覆盖。
export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts'],
        environment: 'node',
        coverage: {
            provider: 'v8',
            all: false,
            // 只统计单测真正能触达的逻辑层；handler / 中间件 / 存储适配器由集成测试与冒烟覆盖，
            // 它们运行在独立进程里，V8 覆盖率拿不到，强行纳入只会得到误导性的 0%。
            include: [
                'server/services/**/*.ts',
                'server/utils/errors/**/*.ts',
                'shared/contracts/**/*.ts',
                'shared/utils/**/*.ts',
            ],
            exclude: ['server/services/*/index.ts', '**/*.d.ts'],
            reporter: ['text-summary', 'json-summary'],
            // 基线实测：statements 96.66 / branches 91.02 / functions 96 / lines 96.66。
            // 阈值取整数下界，等于「当前值略低」，只拦回退，不因四舍五入误报。
            thresholds: {
                statements: 96,
                branches: 91,
                functions: 96,
                lines: 96,
            },
        },
    },
});
