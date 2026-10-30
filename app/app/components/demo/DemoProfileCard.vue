<script setup lang="ts">
const props = withDefaults(
    defineProps<{
        name: string;
        role?: string;
        modelValue?: boolean;
    }>(),
    { role: '团队成员', modelValue: false },
);

const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    follow: [name: string];
}>();

const stats = computed(() => ({
    followers: props.modelValue ? 1286 : 1285,
    posts: 24,
    joined: '2024-03',
}));

function toggleFollow() {
    emit('update:modelValue', !props.modelValue);
}
</script>

<template>
    <div class="profile-card" :class="{ 'is-following': modelValue }">
        <div class="profile-head">
            <span class="profile-avatar" aria-hidden="true">{{ name.slice(0, 1) }}</span>
            <div class="profile-meta">
                <h4 class="profile-name">{{ name }}</h4>
                <p class="profile-role">{{ role }}</p>
            </div>
            <button
                type="button"
                class="btn btn--sm"
                :class="{ 'btn--ghost': modelValue }"
                :aria-pressed="modelValue"
                @click="toggleFollow"
            >
                {{ modelValue ? '已关注' : '关注' }}
            </button>
        </div>

        <div class="profile-body">
            <slot />
        </div>

        <div class="profile-stats">
            <slot name="stats" :followers="stats.followers" :posts="stats.posts" :joined="stats.joined" />
        </div>

        <div class="profile-footer">
            <slot name="footer" :name="name">
                <span class="profile-hint">默认 footer：{{ name }} · {{ role }}</span>
            </slot>
        </div>

        <button type="button" class="profile-action" @click="emit('follow', name)">
            emit('follow', name)
        </button>
    </div>
</template>

<style scoped>
.profile-card {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface);
    transition: border-color 150ms ease, box-shadow 150ms ease;
}

.profile-card.is-following {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
}

.profile-head {
    display: flex;
    align-items: center;
    gap: 12px;
}

.profile-avatar {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border-radius: 999px;
    background: linear-gradient(135deg, var(--accent), var(--accent-strong));
    color: #04130c;
    font-family: var(--font-mono);
    font-size: 18px;
    font-weight: 700;
}

.profile-meta {
    flex: 1;
    min-width: 0;
}

.profile-name {
    margin: 0;
    font-size: 16px;
}

.profile-role {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--text-muted);
}

.profile-body {
    font-size: 13px;
    line-height: 1.7;
    color: var(--text-muted);
}

.profile-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding: 10px 12px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--accent);
}

.profile-footer {
    padding-top: 10px;
    border-top: 1px solid var(--line);
    font-size: 12px;
    color: var(--text-muted);
}

.profile-hint {
    font-family: var(--font-mono);
}

.profile-action {
    align-self: flex-start;
    padding: 5px 10px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 11px;
    cursor: pointer;
    transition: color 140ms ease, border-color 140ms ease;
}

.profile-action:hover {
    color: var(--accent);
    border-color: var(--accent);
}
</style>
