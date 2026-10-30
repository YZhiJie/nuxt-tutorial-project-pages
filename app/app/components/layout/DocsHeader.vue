<script setup lang="ts">
const appConfig = useAppConfig();
const { theme, toggle } = useTheme();
</script>

<template>
    <header class="site-header">
        <div class="container header-inner">
            <NuxtLink to="/" class="brand">
                <span class="brand-mark">N</span>
                <span class="brand-text">
                    <strong>{{ appConfig.title }}</strong>
                    <small>{{ appConfig.subtitle }}</small>
                </span>
            </NuxtLink>

            <nav class="header-nav" aria-label="主导航">
                <NuxtLink to="/#modules">模块</NuxtLink>
                <NuxtLink to="/deployment">部署</NuxtLink>
                <NuxtLink to="/testing">测试</NuxtLink>
                <a :href="appConfig.repoUrl" target="_blank" rel="noopener noreferrer">GitHub</a>
            </nav>

            <div class="header-actions">
                <button
                    type="button"
                    class="theme-toggle"
                    :aria-label="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
                    :title="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
                    @click="toggle"
                >
                    <span v-if="theme === 'dark'" aria-hidden="true">LIGHT</span>
                    <span v-else aria-hidden="true">DARK</span>
                </button>
            </div>
        </div>
    </header>
</template>

<style scoped>
.site-header {
    position: sticky;
    top: 0;
    z-index: 40;
    height: var(--header-h);
    border-bottom: 1px solid var(--line);
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(14px);
}

.header-inner {
    display: flex;
    align-items: center;
    gap: 28px;
    height: 100%;
}

.brand {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
}

.brand-mark {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 9px;
    background: var(--gradient-neon);
    color: var(--accent-contrast);
    font-family: var(--font-mono);
    font-weight: 800;
    font-size: 14px;
    box-shadow: 0 0 18px rgba(78, 168, 255, 0.4);
}

.brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
}

.brand-text strong {
    font-size: 14px;
    letter-spacing: 0.01em;
}

.brand-text small {
    font-size: 11px;
    color: var(--text-faint);
    font-family: var(--font-mono);
}

.header-nav {
    display: flex;
    align-items: center;
    gap: 22px;
    margin-left: auto;
    font-size: 13px;
    color: var(--text-muted);
}

.header-nav a {
    transition: color 150ms ease;
}

.header-nav a:hover {
    color: var(--accent);
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
}

.theme-toggle {
    padding: 5px 10px;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    background: transparent;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    cursor: pointer;
    transition: border-color 150ms ease, color 150ms ease;
}

.theme-toggle:hover {
    border-color: var(--accent);
    color: var(--accent);
}

@media (max-width: 720px) {
    .brand-text small,
    .header-nav {
        display: none;
    }
}
</style>
