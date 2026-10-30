<script setup lang="ts">
import { useId } from 'vue';

const props = withDefaults(
    defineProps<{
        open: boolean;
        title?: string;
        desc?: string;
    }>(),
    { title: '编辑资料', desc: '' },
);

const emit = defineEmits<{ close: [] }>();

const panel = ref<HTMLElement | null>(null);
let lastFocused: HTMLElement | null = null;

const uid = useId();
const titleId = `focus-modal-title-${uid}`;
const descId = `focus-modal-desc-${uid}`;

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(): HTMLElement[] {
    const root = panel.value;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
}

// 打开：记录触发元素并聚焦面板；关闭：焦点回归触发元素
watch(
    () => props.open,
    async (isOpen) => {
        if (!import.meta.client) return;
        if (isOpen) {
            lastFocused = document.activeElement as HTMLElement | null;
            await nextTick();
            panel.value?.focus();
        } else {
            lastFocused?.focus();
            lastFocused = null;
        }
    },
    { flush: 'post' },
);

function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
        event.preventDefault();
        emit('close');
        return;
    }
    if (event.key !== 'Tab') return;

    const items = focusables();
    const first = items[0];
    const last = items[items.length - 1];

    if (!first || !last) {
        event.preventDefault();
        panel.value?.focus();
        return;
    }

    const active = document.activeElement;

    if (event.shiftKey) {
        if (active === first || active === panel.value) {
            event.preventDefault();
            last.focus();
        }
    } else if (active === last) {
        event.preventDefault();
        first.focus();
    }
}
</script>

<template>
    <Teleport to="body">
        <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
            <div
                ref="panel"
                class="modal-panel"
                role="dialog"
                aria-modal="true"
                :aria-labelledby="titleId"
                :aria-describedby="desc ? descId : undefined"
                tabindex="-1"
                @keydown="onKeydown"
            >
                <header class="modal-head">
                    <div>
                        <p :id="titleId" class="modal-title">{{ title }}</p>
                        <p v-if="desc" :id="descId" class="modal-desc">{{ desc }}</p>
                    </div>
                    <button type="button" class="modal-close" aria-label="关闭对话框" @click="emit('close')">
                        ×
                    </button>
                </header>

                <div class="modal-body">
                    <slot />
                </div>

                <footer class="modal-foot">
                    <button type="button" class="btn btn--ghost btn--sm" @click="emit('close')">
                        取消
                    </button>
                    <button type="button" class="btn btn--sm" @click="emit('close')">
                        保存并关闭
                    </button>
                </footer>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(4, 8, 6, 0.72);
    animation: backdrop-in 160ms ease;
}

.modal-panel {
    width: min(440px, 100%);
    max-height: calc(100vh - 48px);
    overflow: auto;
    padding: 18px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--bg-elevated);
    box-shadow: var(--shadow);
    animation: panel-in 180ms ease;
}

.modal-panel:focus {
    outline: none;
}

.modal-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--line);
}

.modal-title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
}

.modal-desc {
    margin: 3px 0 0;
    font-size: 12px;
    color: var(--text-muted);
}

.modal-close {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
}

.modal-close:hover {
    border-color: var(--accent);
    color: var(--accent);
}

.modal-body {
    padding: 14px 0;
}

.modal-foot {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
}

@keyframes backdrop-in {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

@keyframes panel-in {
    from {
        opacity: 0;
        transform: translateY(8px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@media (prefers-reduced-motion: reduce) {
    .modal-backdrop,
    .modal-panel {
        animation: none;
    }
}
</style>
