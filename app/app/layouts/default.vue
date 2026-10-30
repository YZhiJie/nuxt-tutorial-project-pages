<template>
    <!-- 首页等无侧边栏场景：顶栏 + 内容 + 页脚 -->
    <div class="layout-default">
        <DocsHeader />
        <main class="layout-main">
            <slot />
        </main>
        <DocsFooter />
    </div>
</template>

<style scoped>
.layout-main {
    min-height: calc(100vh - var(--header-h) - 120px);
}
</style>
