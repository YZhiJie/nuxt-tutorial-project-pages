<template>
    <!-- 文档布局：顶栏 + 左侧模块导航 + 内容区 + 页脚 -->
    <div class="layout-docs">
        <DocsHeader />
        <div class="docs-shell">
            <DocsSidebar />
            <div class="docs-content">
                <ContentLoading />
                <div class="docs-content-inner">
                    <slot />
                </div>
            </div>
        </div>
        <DocsFooter />
    </div>
</template>

<style scoped>
.docs-shell {
    display: flex;
    align-items: flex-start;
    width: 100%;
    max-width: var(--maxw);
    margin: 0 auto;
    padding: 0 24px;
}

.docs-content {
    position: relative;
    flex: 1;
    min-width: 0;
    padding-left: 44px;
}

.docs-content-inner {
    min-height: calc(100vh - var(--header-h) - 140px);
}

@media (max-width: 1080px) {
    .docs-content {
        padding-left: 0;
    }
}

@media (max-width: 720px) {
    .docs-shell {
        padding: 0 16px;
    }
}
</style>
