<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const modalOpen = ref(false);
const skipTarget = ref<HTMLElement | null>(null);
const likes = ref(0);
const liveText = ref('尚未点赞');

function focusSkipTarget() {
    skipTarget.value?.focus();
}

function like() {
    likes.value += 1;
    liveText.value = `已点赞 ${likes.value} 次`;
}

const LANDMARK_CODE = `<!-- skip link：默认移出视口，键盘聚焦时才出现 -->
<a class="skip-link" href="#main">跳到主内容</a>

<header>…</header>
<nav aria-label="文档导航">…</nav>
<main id="main" tabindex="-1">…</main>
<footer>…</footer>

<!-- 多个 nav / aside 必须用 aria-label 区分；landmark 不应嵌套滥用 -->`;

const MODAL_CODE = `// 打开时记录触发元素，聚焦面板；关闭时把焦点还回去
watch(() => props.open, async (isOpen) => {
    if (isOpen) {
        lastFocused = document.activeElement;
        await nextTick();
        panel.value?.focus();
    } else {
        lastFocused?.focus();
    }
});

// Tab 循环：在首尾之间折返，Esc 关闭
function onKeydown(event) {
    if (event.key === 'Escape') return emit('close');
    if (event.key !== 'Tab') return;
    const items = focusables();
    if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items[items.length - 1].focus();
    } else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
        event.preventDefault();
        items[0].focus();
    }
}`;

const LIVE_CODE = `<!-- role=status 自带 aria-live=polite，适合“已完成 / 已保存” -->
<p role="status" aria-live="polite" aria-atomic="true">
    已点赞 3 次
</p>

<!-- 错误提示用 assertive，但不要滥用：会打断读屏当前朗读 -->
<p role="alert" aria-live="assertive">保存失败，请检查网络</p>

<!-- 纯视觉隐藏但仍被读屏读取 -->
<style>
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
}
</style>`;

const MOTION_CODE = `/* 尊重系统“减少动态效果”设置 */
@media (prefers-reduced-motion: reduce) {
    .modal-backdrop,
    .modal-panel {
        animation: none;
        transition: none;
    }

    * {
        scroll-behavior: auto !important;
    }
}`;

const contrast = [
    { element: '正文文字', ratio: '≥ 4.5:1', note: '14px 以下都属于正文，最容易忽略' },
    { element: '大字号标题', ratio: '≥ 3:1', note: '18.66px 加粗或 24px 以上' },
    { element: '图标与边框', ratio: '≥ 3:1', note: '纯装饰元素可豁免' },
    { element: '焦点指示', ratio: '≥ 3:1', note: '必须与相邻颜色可区分，不能仅靠颜色变化' },
];

const checks = [
    '只用键盘能否完成页面所有操作？Tab 顺序是否与视觉顺序一致？',
    '焦点是否可见？是否被 CSS 的 outline: none 整体移除？',
    '对话框打开后焦点是否进入、关闭后是否回到触发按钮？',
    '所有图标按钮是否有 aria-label 或可见文字？',
    '状态变化是否有 aria-live 播报，而不是只有颜色或动画？',
    '是否存在仅靠颜色传达的信息（红 / 绿表示成功失败）？',
    'reduced-motion 下动画是否被关闭或大幅缩短？',
    '页面是否只有一个 main，landmark 是否可被读屏快速跳转？',
];
</script>

<template>
    <DocPage
        title="无障碍实践"
        description="无障碍不是额外功能，而是“键盘与读屏用户能否完成同一件事”。语义结构、焦点管理、状态播报与动效偏好，构成了最小可用的实践集。"
        :tags="['skip link', 'landmark', '焦点陷阱', 'aria-live', 'reduced-motion']"
    >
        <DocSection id="structure" title="语义结构与 skip link" kicker="01 · STRUCTURE">
            <p class="body-text">
                读屏用户靠 landmark 快速跳转。页面需要唯一的 <code>main</code>，
                多个导航区域用 <code>aria-label</code> 区分。skip link 让键盘用户
                跳过重复的导航，直接进入正文。
            </p>
            <CodeBlock :code="LANDMARK_CODE" lang="html" title="landmark 与 skip link" />
            <DemoCard title="skip link 实测" desc="按 Tab 让链接出现，再按 Enter 跳到内容起点。" badge="LIVE">
                <div class="skip-wrap">
                    <a href="#a11y-skip-target" class="skip-link" @click.prevent="focusSkipTarget">
                        跳到主内容
                    </a>
                    <div id="a11y-skip-target" ref="skipTarget" tabindex="-1" class="skip-target">
                        <p class="skip-title">主内容起点</p>
                        <p class="skip-text">
                            这个容器带有 <code>tabindex="-1"</code>，可被编程聚焦但不会进入 Tab 顺序。
                        </p>
                    </div>
                </div>
                <template #footer>Tab 聚焦 → Enter 触发 → 焦点落到下方容器。</template>
            </DemoCard>
        </DocSection>

        <DocSection id="focus" title="键盘可达与焦点陷阱" kicker="02 · FOCUS">
            <p class="body-text">
                对话框必须满足三件事：打开后焦点进入、Tab 在内部循环、关闭后焦点回到触发元素。
                缺少任何一条，键盘用户都可能“困在”页面某处或丢失位置。
            </p>
            <CodeBlock :code="MODAL_CODE" lang="ts" title="焦点管理三要素" />
            <DemoCard
                title="焦点陷阱模态框"
                desc="打开后聚焦面板；Tab 在按钮与输入框间循环；Esc 关闭并回归焦点。"
                badge="LIVE"
            >
                <button class="btn" type="button" @click="modalOpen = true">打开模态框</button>
                <p class="demo-hint">关闭后观察焦点是否回到这个按钮上。</p>

                <ClientOnly>
                    <DemoFocusModal
                        :open="modalOpen"
                        title="编辑资料"
                        desc="这是一个带焦点陷阱的演示对话框。"
                        @close="modalOpen = false"
                    >
                        <div class="modal-form">
                            <label class="field">
                                <span class="field-label">昵称</span>
                                <input class="input" type="text" placeholder="输入昵称" />
                            </label>
                            <label class="field">
                                <span class="field-label">邮箱</span>
                                <input class="input" type="email" placeholder="you@example.com" />
                            </label>
                        </div>
                    </DemoFocusModal>
                </ClientOnly>

                <template #footer>组件文件：app/components/demo/DemoFocusModal.vue</template>
            </DemoCard>
        </DocSection>

        <DocSection id="live" title="aria-live 状态播报" kicker="03 · LIVE REGION">
            <p class="body-text">
                视觉更新对读屏用户是不可见的。用 live region 播报结果：
                <code>polite</code> 等当前朗读结束，<code>assertive</code> 立即打断。
                只播报结果，不播报每一次输入。
            </p>
            <CodeBlock :code="LIVE_CODE" lang="html" title="live region 用法" />
            <DemoCard title="状态播报计数器" desc="点击后 live region 会播报新的点赞数。" badge="LIVE">
                <div class="like-row">
                    <button class="btn" type="button" @click="like">点赞</button>
                    <span class="like-count mono">count = {{ likes }}</span>
                </div>
                <p class="live-region" role="status" aria-live="polite" aria-atomic="true">
                    {{ liveText }}
                </p>
                <template #footer>
                    屏幕阅读器会把整段文本读一次；视觉上则是一个普通状态行。
                </template>
            </DemoCard>
        </DocSection>

        <DocSection id="motion" title="动效偏好与对比度" kicker="04 · MOTION">
            <p class="body-text">
                前庭功能敏感的用户会被大幅动画影响。用
                <code>prefers-reduced-motion</code> 关闭或缩短动画，
                而不是直接删除所有过渡——保留即时反馈更重要。
            </p>
            <CodeBlock :code="MOTION_CODE" lang="css" title="reduced-motion" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>元素</th><th>最低对比度</th><th>说明</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in contrast" :key="row.element">
                            <td>{{ row.element }}</td>
                            <td class="mono">{{ row.ratio }}</td>
                            <td>{{ row.note }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="checks" title="上线前检查单" kicker="05 · CHECK">
            <ul class="checklist">
                <li v-for="item in checks" :key="item">{{ item }}</li>
            </ul>
        </DocSection>
    </DocPage>
</template>

<style scoped>
.body-text {
    margin: 0 0 12px;
    font-size: 14px;
    line-height: 1.8;
    color: var(--text-muted);
}

.skip-wrap {
    position: relative;
    padding-top: 34px;
}

.skip-link {
    position: absolute;
    top: 0;
    left: 0;
    padding: 8px 14px;
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    background: var(--accent);
    color: #04130c;
    font-size: 13px;
    font-weight: 600;
    transform: translateY(-150%);
    transition: transform 140ms ease;
}

.skip-link:focus {
    transform: translateY(0);
}

.skip-target {
    padding: 12px 14px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
}

.skip-target:focus {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}

.skip-title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
}

.skip-text {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--text-muted);
}

.demo-hint {
    margin: 10px 0 0;
    font-size: 12px;
    color: var(--text-faint);
}

.modal-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.field-label {
    font-size: 12px;
    color: var(--text-muted);
}

.like-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

.like-count {
    font-size: 12px;
    color: var(--text-muted);
}

.live-region {
    margin: 12px 0 0;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    font-size: 13px;
    color: var(--accent);
}

.checklist {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.checklist li {
    position: relative;
    padding-left: 26px;
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.7;
}

.checklist li::before {
    content: '✓';
    position: absolute;
    left: 0;
    top: 0;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 11px;
}
</style>
