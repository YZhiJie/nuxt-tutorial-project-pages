import { MODULES, moduleByPath, PAGE_SEQUENCE, type Module } from '#shared/knowledge/modules';

/**
 * 文档导航：当前模块、模块内页面、上一篇 / 下一篇。
 * 侧边栏、DocPage 与首页都复用这一份计算。
 */
export function useDocsNav() {
    const route = useRoute();

    const currentModule = computed<Module | undefined>(() => moduleByPath(route.path));

    // 当前路径在模块内的位置（模块首页排在子页之前）
    const currentIndex = computed(() =>
        PAGE_SEQUENCE.findIndex((page) => page.href === route.path.replace(/\/$/, '')),
    );

    const prev = computed(() =>
        currentIndex.value > 0 ? PAGE_SEQUENCE[currentIndex.value - 1] : undefined,
    );
    const next = computed(() =>
        currentIndex.value >= 0 && currentIndex.value < PAGE_SEQUENCE.length - 1
            ? PAGE_SEQUENCE[currentIndex.value + 1]
            : undefined,
    );

    // 当前模块下的页面（模块首页 + demos），侧边栏展开用
    const modulePages = computed(() => {
        const mod = currentModule.value;
        if (!mod) return [];
        return [
            { title: '模块总览', href: `/${mod.key}` },
            ...mod.demos.map((demo) => ({ title: demo.name, href: demo.href })),
        ];
    });

    return { modules: MODULES, currentModule, modulePages, prev, next };
}
