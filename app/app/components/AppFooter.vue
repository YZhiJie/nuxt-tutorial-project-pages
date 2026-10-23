<script setup lang="ts">
const year = new Date().getFullYear();
</script>

<template>
    <footer class="site-footer">
        <div class="container">
            <p>© {{ year }} Nuxt LearnHub · Nuxt 教程配套示例项目</p>
        </div>
    </footer>
</template>

<style scoped>
.site-footer {
    margin-top: 48px;
    padding: 24px 0;
    border-top: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-size: 14px;
    text-align: center;
}
</style>
