<script setup lang="ts">
import { findModule, type Module } from '#shared/knowledge/modules';

const props = defineProps<{
    title: string;
    description?: string;
    kicker?: string;
    moduleKey?: string;
    tags?: string | string[];
}>();

const { currentModule, modulePages, prev, next } = useDocsNav();

// 兼容 :tags="['a','b']" 与 tags="a,b" 两种写法
const tagList = computed(() => {
    if (!props.tags) return [];
    return Array.isArray(props.tags)
        ? props.tags
        : props.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean);
});

const mod = computed<Module | undefined>(() =>
    props.moduleKey ? findModule(props.moduleKey) ?? currentModule.value : currentModule.value,
);

useDocMeta({ title: props.title, description: props.description });
</script>

<template>
    <article class="doc-page">
        <nav class="breadcrumb" aria-label="面包屑">
            <NuxtLink to="/">首页</NuxtLink>
            <span aria-hidden="true">/</span>
            <NuxtLink v-if="mod" :to="`/${mod.key}`">{{ mod.title }}</NuxtLink>
            <span v-if="mod" aria-hidden="true">/</span>
            <span class="current">{{ title }}</span>
        </nav>

        <header class="doc-head">
            <p v-if="mod" class="eyebrow">{{ mod.mark }} · {{ mod.title }}</p>
            <p v-else-if="kicker" class="eyebrow">{{ kicker }}</p>
            <h1>{{ title }}</h1>
            <p v-if="description" class="lead">{{ description }}</p>
            <ul v-if="tagList.length" class="tag-list">
                <li v-for="tag in tagList" :key="tag" class="badge">{{ tag }}</li>
            </ul>
        </header>

        <nav v-if="modulePages.length > 1" class="module-pages" aria-label="模块内页面">
            <NuxtLink
                v-for="page in modulePages"
                :key="page.href"
                :to="page.href"
                class="module-page-link"
                :class="{ active: $route.path.replace(/\/$/, '') === page.href }"
            >
                {{ page.title }}
            </NuxtLink>
        </nav>

        <div class="doc-body">
            <slot />
        </div>

        <nav class="doc-pager" aria-label="上一篇 / 下一篇">
            <NuxtLink v-if="prev" :to="prev.href" class="pager-link pager-link--prev">
                <span class="pager-label">← 上一篇</span>
                <span class="pager-title">{{ prev.title }}</span>
            </NuxtLink>
            <span v-else />
            <NuxtLink v-if="next" :to="next.href" class="pager-link pager-link--next">
                <span class="pager-label">下一篇 →</span>
                <span class="pager-title">{{ next.title }}</span>
            </NuxtLink>
        </nav>
    </article>
</template>

<style scoped>
.doc-page {
    max-width: 860px;
    padding: 34px 0 20px;
}

.breadcrumb {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 18px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-faint);
}

.breadcrumb a:hover {
    color: var(--accent);
}

.breadcrumb .current {
    color: var(--text-muted);
}

.doc-head h1 {
    margin: 6px 0 12px;
    font-size: clamp(28px, 4vw, 38px);
    line-height: 1.2;
    letter-spacing: -0.02em;
    background: var(--gradient-neon);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
}

.tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 18px 0 0;
    padding: 0;
    list-style: none;
}

.module-pages {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 26px 0 0;
    padding: 14px 0;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
}

.module-page-link {
    padding: 4px 11px;
    border: 1px solid var(--line);
    border-radius: 999px;
    font-size: 12px;
    color: var(--text-muted);
    transition: border-color 140ms ease, color 140ms ease, background 140ms ease;
}

.module-page-link:hover {
    border-color: var(--accent);
    color: var(--accent);
}

.module-page-link.active {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
}

.doc-body {
    display: flex;
    flex-direction: column;
    gap: 22px;
    margin-top: 30px;
}

.doc-pager {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-top: 46px;
    padding-top: 24px;
    border-top: 1px solid var(--line);
}

.pager-link {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    transition: border-color 150ms ease, transform 150ms ease;
}

.pager-link:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
}

.pager-link--next {
    text-align: right;
    align-items: flex-end;
}

.pager-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-faint);
}

.pager-title {
    font-size: 14px;
    font-weight: 600;
}

@media (max-width: 620px) {
    .doc-pager {
        grid-template-columns: 1fr;
    }

    .pager-link--next {
        text-align: left;
        align-items: flex-start;
    }
}
</style>
