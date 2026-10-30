import { defineConfig } from 'vitest/config';

// 纯单测配置：只跑不依赖 Nuxt 运行时的纯函数测试
export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts'],
        environment: 'node',
    },
});
