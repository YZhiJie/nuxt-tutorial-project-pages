<script setup lang="ts">
const props = withDefaults(
    defineProps<{
        code: string;
        lang?: string;
        title?: string;
        /** 展示行号 */
        lineNumbers?: boolean;
    }>(),
    { lang: 'ts', lineNumbers: false },
);

const copied = ref(false);
const lines = computed(() => props.code.replace(/\n$/, '').split('\n'));

async function copy() {
    if (!import.meta.client) return;
    try {
        await navigator.clipboard.writeText(props.code);
        copied.value = true;
        window.setTimeout(() => (copied.value = false), 1600);
    } catch {
        copied.value = false;
    }
}
</script>

<template>
    <div class="code-block">
        <div class="code-head">
            <span class="code-title mono">{{ title ?? lang }}</span>
            <button type="button" class="copy-btn" @click="copy">
                {{ copied ? '已复制' : '复制' }}
            </button>
        </div>
        <pre :class="{ 'with-lines': lineNumbers }"><code><template v-if="lineNumbers"><span
                    v-for="(line, i) in lines"
                    :key="i"
                    class="code-line"
                ><span class="line-no">{{ i + 1 }}</span>{{ line }}</span></template><template v-else>{{ code.replace(/\n$/, '') }}</template></code></pre>
    </div>
</template>

<style scoped>
.code-block {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--bg-elevated);
}

.code-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 12px;
    border-bottom: 1px solid var(--line);
    background: var(--surface-2);
}

.code-title {
    font-size: 11px;
    color: var(--text-muted);
    letter-spacing: 0.04em;
}

.copy-btn {
    padding: 3px 9px;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: transparent;
    color: var(--text-faint);
    font-size: 11px;
    cursor: pointer;
    transition: color 140ms ease, border-color 140ms ease;
}

.copy-btn:hover {
    color: var(--accent);
    border-color: var(--accent);
}

pre {
    margin: 0;
    padding: 14px 16px;
    border: none;
    border-radius: 0;
    background: transparent;
    font-size: 12.5px;
    line-height: 1.75;
}

code {
    padding: 0;
    background: transparent;
    color: var(--text);
}

.code-line {
    display: block;
    padding-left: 38px;
    position: relative;
}

.line-no {
    position: absolute;
    left: 0;
    width: 26px;
    text-align: right;
    color: var(--text-faint);
    user-select: none;
}
</style>
