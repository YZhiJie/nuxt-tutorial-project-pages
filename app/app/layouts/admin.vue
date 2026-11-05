<template>
    <!-- 后台布局：侧边导航 + 内容区，与前台默认布局隔离 -->
    <div class="layout-admin">
        <aside class="admin-sidebar">
            <NuxtLink to="/admin" class="admin-brand">Nuxt LearnHub</NuxtLink>
            <nav class="admin-nav">
                <NuxtLink to="/admin">概览</NuxtLink>
                <NuxtLink to="/notes">笔记管理</NuxtLink>
                <NuxtLink to="/dashboard">控制台</NuxtLink>
            </nav>
            <NuxtLink to="/" class="admin-back">返回站点</NuxtLink>
        </aside>
        <main class="admin-main">
            <slot />
        </main>
    </div>
</template>

<style scoped>
.layout-admin {
    display: flex;
    min-height: 100vh;
}

.admin-sidebar {
    width: 200px;
    flex-shrink: 0;
    padding: 24px 16px;
    background: var(--color-surface);
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.admin-brand {
    font-weight: 700;
    color: var(--color-primary-dark);
}

.admin-nav {
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-size: 14px;
}

.admin-nav a.router-link-active {
    color: var(--color-primary-dark);
    font-weight: 600;
}

.admin-back {
    margin-top: auto;
    color: var(--color-text-muted);
    font-size: 13px;
}

.admin-main {
    flex: 1;
    padding: 32px;
}

@media (max-width: 720px) {
    .layout-admin {
        flex-direction: column;
    }

    .admin-sidebar {
        width: auto;
        flex-direction: row;
        align-items: center;
        border-right: none;
        border-bottom: 1px solid var(--color-border);
    }

    .admin-nav {
        flex-direction: row;
    }

    .admin-back {
        margin-top: 0;
        margin-left: auto;
    }

    .admin-main {
        padding: 20px;
    }
}
</style>
