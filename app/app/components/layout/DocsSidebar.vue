<script setup lang="ts">
const { modules, currentModule } = useDocsNav();
const route = useRoute();

const isActive = (href: string) => route.path.replace(/\/$/, '') === href;
</script>

<template>
    <aside class="docs-sidebar" aria-label="知识模块导航">
        <div class="sidebar-inner">
            <p class="sidebar-label">知识地图</p>

            <nav class="sidebar-list">
                <div v-for="mod in modules" :key="mod.key" class="sidebar-group">
                    <NuxtLink
                        :to="`/${mod.key}`"
                        class="sidebar-module"
                        :class="{ active: currentModule?.key === mod.key }"
                    >
                        <span class="sidebar-mark">{{ mod.mark }}</span>
                        <span>{{ mod.title }}</span>
                    </NuxtLink>

                    <div v-if="currentModule?.key === mod.key" class="sidebar-pages">
                        <NuxtLink
                            :to="`/${mod.key}`"
                            class="sidebar-page"
                            :class="{ active: isActive(`/${mod.key}`) }"
                        >
                            模块总览
                        </NuxtLink>
                        <NuxtLink
                            v-for="demo in mod.demos"
                            :key="demo.href"
                            :to="demo.href"
                            class="sidebar-page"
                            :class="{ active: isActive(demo.href) }"
                        >
                            {{ demo.name }}
                        </NuxtLink>
                    </div>
                </div>
            </nav>

            <div class="sidebar-footer">
                <p class="mono">Nuxt 4 · Vue 3.5</p>
                <p>每模块附原理、示例与常见坑。</p>
            </div>
        </div>
    </aside>
</template>

<style scoped>
.docs-sidebar {
    position: sticky;
    top: var(--header-h);
    align-self: flex-start;
    width: var(--sidebar-w);
    flex-shrink: 0;
    height: calc(100vh - var(--header-h));
    border-right: 1px solid var(--line);
    overflow-y: auto;
}

.sidebar-inner {
    padding: 24px 18px 40px;
}

.sidebar-label {
    margin: 0 0 14px 10px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-faint);
}

.sidebar-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.sidebar-module {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 13px;
    color: var(--text-muted);
    transition: background 140ms ease, color 140ms ease;
}

.sidebar-module:hover {
    background: var(--surface-2);
    color: var(--text);
}

.sidebar-module.active {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 600;
}

.sidebar-mark {
    width: 30px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.06em;
    color: var(--text-faint);
    text-align: center;
}

.sidebar-module.active .sidebar-mark {
    color: var(--accent);
}

.sidebar-pages {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin: 4px 0 10px 20px;
    padding-left: 12px;
    border-left: 1px solid var(--line);
}

.sidebar-page {
    padding: 5px 8px;
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-faint);
    line-height: 1.45;
    transition: color 130ms ease, background 130ms ease;
}

.sidebar-page:hover {
    color: var(--text);
    background: var(--surface-2);
}

.sidebar-page.active {
    color: var(--accent);
    background: var(--accent-soft);
}

.sidebar-footer {
    margin-top: 28px;
    padding: 14px 12px;
    border: 1px dashed var(--line-strong);
    border-radius: 10px;
    font-size: 11px;
    color: var(--text-faint);
    line-height: 1.6;
}

.sidebar-footer p {
    margin: 0;
}

.sidebar-footer .mono {
    color: var(--text-muted);
}

@media (max-width: 1080px) {
    .docs-sidebar {
        display: none;
    }
}
</style>
