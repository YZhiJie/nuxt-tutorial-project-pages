<template>
    <!-- 默认布局：头部导航 + 页面内容 + 页脚 -->
    <div class="layout-default">
        <AppHeader />
        <main class="container main-content">
            <slot />
        </main>
        <AppFooter />
    </div>
</template>

<style scoped>
.main-content {
    padding-top: 32px;
    min-height: 60vh;
}
</style>
