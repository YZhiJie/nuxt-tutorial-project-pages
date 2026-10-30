<script setup lang="ts">
const year = new Date().getFullYear();
const appConfig = useAppConfig();
</script>

<template>
    <footer class="docs-footer">
        <div class="container footer-inner">
            <p class="muted">© {{ year }} {{ appConfig.title }} · 企业级 Nuxt 工程知识库</p>
            <p class="faint mono">Nuxt 4 · Vue 3.5 · Nitro · TypeScript</p>
        </div>
    </footer>
</template>

<style scoped>
.docs-footer {
    margin-top: 64px;
    border-top: 1px solid var(--line);
    padding: 24px 0 40px;
}

.footer-inner {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    font-size: 12px;
}
</style>
