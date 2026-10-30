<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const dir = ref<'ltr' | 'rtl'>('ltr');
const isRtl = computed(() => dir.value === 'rtl');

function toggleDir() {
    dir.value = isRtl.value ? 'ltr' : 'rtl';
}

const DIRECTION_CODE = `<!-- 方向属于文档结构，不是样式补丁 -->
<html lang="ar" dir="rtl">
  <!-- 或局部容器 -->
  <section dir="rtl" lang="ar">…</section>

<!-- 方向影响 -->
<!-- 1. 行内起点 / 终点：text-align: start / end -->
<!-- 2. Flex 主轴：flex-direction: row 会随 direction 翻转 -->
<!-- 3. 滚动条、表单控件、图标相对位置 -->
<!-- 4. 省略号与截断出现在 inline-end，而不是固定右侧 -->

<!-- 不要用 transform: scaleX(-1) 翻转整页 -->
<!-- 只镜像「有方向含义」的图标（返回箭头、进度条） -->`;

const LOGICAL_CODE = `/* 逻辑属性：按书写方向自动适配 */
.card {
    padding-inline: 16px;          /* 左右内边距，随方向翻转 */
    padding-block: 12px;           /* 上下内边距 */
    margin-inline-start: 14px;     /* 行内起点，LTR=左，RTL=右 */
    border-inline-start: 3px solid var(--accent);
    inset-inline-start: 14px;      /* 绝对定位的起点 */
    text-align: start;             /* 对齐到行内起点 */
}

/* 物理属性：固定在左 / 右，不随方向变化 */
.card--legacy {
    padding-left: 16px;
    padding-right: 16px;
    margin-left: 14px;
    border-left: 3px solid var(--accent);
    left: 14px;
    text-align: left;
}`;

const MIRROR_CODE = `/* 需要镜像：表示「前进 / 返回 / 方向」的图标 */
.icon-back { transform: scaleX(-1); }   /* 仅在 RTL 下需要 */
[dir='rtl'] .icon-arrow { transform: scaleX(-1); }

/* 不需要镜像：播放 / 暂停、勾选、齿轮、品牌 logo、人物头像 */
/* 媒体播放器、相机取景框也不要整体翻转 */

/* 数字与混合文本 */
/* 1. 数字本身保持 LTR 方向，不需要镜像 */
/* 2. 中文 + 阿拉伯文混排时用 <bdi> 隔离，避免标点跳到错误一侧 */
<p>总计 <bdi>1,299</bdi> 条记录</p>

/* 3. 用 <bdo dir="ltr"> 强制某段文本方向 */
/* 4. 不要对数字容器用 direction: rtl，否则 1,299 可能被重排成 299,1 */`;

const comparison = [
    { logical: 'padding-inline-start', physical: 'padding-left', meaning: '行内起点内边距', rtl: '自动变到右侧' },
    { logical: 'margin-inline-end', physical: 'margin-right', meaning: '行内终点外边距', rtl: '自动变到左侧' },
    { logical: 'border-inline-start', physical: 'border-left', meaning: '行内起点边框', rtl: '边框移到右侧' },
    { logical: 'inset-inline-start', physical: 'left', meaning: '绝对定位起点', rtl: '自动贴右' },
    { logical: 'text-align: start', physical: 'text-align: left', meaning: '文本对齐', rtl: '自动右对齐' },
];

const pitfalls = [
    '全局翻转整页（scaleX(-1)）会连文字和图片一起镜像，不可读。',
    '物理属性在 RTL 下不会自动翻转，位置错位通常来自 margin-left / left / text-align: left。',
    '图标镜像只针对方向性图标；勾选、播放、齿轮、品牌 logo 不应该翻转。',
    '数字保持 LTR，但混排标点需要用 bdi 或双向隔离字符控制。',
    '切到 RTL 后要重新检查滚动条、下拉箭头、Toast 出现方向与表单错误提示位置。',
    '测试时不要只看布局：用阿拉伯语真实长文本，比 Lorem Ipsum 更容易暴露溢出。',
];
</script>

<template>
    <DocPage
        title="RTL 布局"
        description="从右到左不是把页面水平翻转，而是让「行内起点」随书写方向变化。逻辑属性是让一套样式同时服务 LTR 与 RTL 的关键。"
        :tags="['dir', '逻辑属性', '物理属性', '图标镜像', '双向文本']"
    >
        <DocSection id="direction" title="方向由文档结构决定" kicker="01 · DIRECTION">
            <p class="body-text">
                <code>dir="rtl"</code> 是语义声明，不是视觉补丁。它会影响文本对齐、Flex 主轴、
                绝对定位的起点与滚动方向。正确做法是：结构上声明方向，样式里使用逻辑属性，
                让同一套 CSS 在两种方向下自动适配。
            </p>
            <CodeBlock :code="DIRECTION_CODE" lang="html" title="声明方向而不是翻转页面" />
        </DocSection>

        <DocSection id="logical" title="逻辑属性 vs 物理属性" kicker="02 · LOGICAL">
            <p class="body-text">
                逻辑属性用「行内 / 块级、起点 / 终点」描述位置，浏览器根据 <code>direction</code>
                自动映射到真实左右。物理属性写死 <code>left</code> 或 <code>right</code>，
                在 RTL 下不会翻转，于是出现「文字在右、图标还在左」的错位。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>逻辑属性</th><th>物理属性</th><th>含义</th><th>RTL 行为</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in comparison" :key="row.logical">
                            <td class="mono">{{ row.logical }}</td>
                            <td class="mono">{{ row.physical }}</td>
                            <td>{{ row.meaning }}</td>
                            <td>{{ row.rtl }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="LOGICAL_CODE" lang="css" title="同一组件的两种写法" />
        </DocSection>

        <DocSection id="mirror" title="图标镜像与数字方向" kicker="03 · MIRROR">
            <p class="body-text">
                并不是所有图标都要镜像。表示前进、返回、缩进、阅读方向的图标需要翻转；
                勾选、播放、齿轮、品牌 logo、人物头像不需要。
                数字本身始终按 LTR 阅读，但混排标点需要用 <code>&lt;bdi&gt;</code> 做隔离。
            </p>
            <CodeBlock :code="MIRROR_CODE" lang="css" title="镜像规则与双向文本" />
            <Callout type="warn" title="不要全局 scaleX(-1)">
                整页翻转会把文字、头像、地图一起镜像，既不可读也无法通过无障碍检查。
                只对方向性图标做局部 <code>transform: scaleX(-1)</code>。
            </Callout>
        </DocSection>

        <DocSection id="demo" title="切换 dir，观察两套属性" kicker="04 · DEMO">
            <p class="body-text">
                下面两个卡片结构完全相同，只有 CSS 不同。左侧使用逻辑属性，
                右侧使用物理属性。切换到 RTL 后，逻辑卡片的强调点与内边距会一起移到右侧，
                物理卡片则保持原位，文字与装饰错位。
            </p>
            <DemoCard
                title="LTR / RTL 对照台"
                desc="点击切换 dir；观察两张卡片的起点装饰、内边距与对齐方式。"
                badge="LIVE"
            >
                <div class="dir-switch" role="group" aria-label="文本方向切换">
                    <button
                        type="button"
                        class="btn btn--sm"
                        :class="{ 'btn--ghost': isRtl }"
                        :aria-pressed="!isRtl"
                        @click="dir = 'ltr'"
                    >
                        LTR · 从左到右
                    </button>
                    <button
                        type="button"
                        class="btn btn--sm"
                        :class="{ 'btn--ghost': !isRtl }"
                        :aria-pressed="isRtl"
                        @click="dir = 'rtl'"
                    >
                        RTL · 从右到左
                    </button>
                    <button type="button" class="btn btn--ghost btn--sm" @click="toggleDir">
                        切换 direction
                    </button>
                </div>

                <p class="dir-readout mono">dir = "{{ dir }}" · 行内起点 = {{ isRtl ? '右侧' : '左侧' }}</p>

                <div class="rtl-stage" :dir="dir" lang="ar">
                    <div class="rtl-row">
                        <div class="rtl-card rtl-card--logical">
                            <span class="rtl-dot" aria-hidden="true" />
                            <p class="rtl-title">逻辑属性</p>
                            <p class="rtl-desc">
                                padding-inline-start / inset-inline-start。
                                起点装饰随方向自动切换到右侧，文字从右侧开始。
                            </p>
                            <p class="rtl-sample">مرحبا بالعالم — 2026</p>
                        </div>

                        <div class="rtl-card rtl-card--physical">
                            <span class="rtl-dot" aria-hidden="true" />
                            <p class="rtl-title">物理属性</p>
                            <p class="rtl-desc">
                                padding-left / left。装饰固定在左侧，文字却从右侧开始，
                                RTL 下两者分离。
                            </p>
                            <p class="rtl-sample">مرحبا بالعالم — 2026</p>
                        </div>
                    </div>

                    <div class="rtl-inline">
                        <span class="rtl-chip" aria-hidden="true">→</span>
                        <span>方向性图标在 RTL 下需要镜像，数字 <bdi>1,299</bdi> 不需要。</span>
                    </div>
                </div>

                <template #footer>
                    逻辑属性跟随 <code>direction</code>；物理属性不会。数字保持 LTR 阅读顺序。
                </template>
            </DemoCard>
        </DocSection>

        <DocSection id="pitfalls" title="RTL 迁移清单" kicker="05 · CHECKLIST">
            <ul class="checklist">
                <li v-for="item in pitfalls" :key="item">{{ item }}</li>
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

.dir-switch {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.dir-readout {
    margin: 12px 0 14px;
    font-size: 11px;
    color: var(--text-faint);
}

.rtl-stage {
    padding: 16px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
}

.rtl-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
}

.rtl-card {
    position: relative;
    padding-block: 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
}

.rtl-card--logical {
    padding-inline: 18px 16px;
    border-inline-start: 3px solid var(--accent);
}

.rtl-card--logical .rtl-dot {
    inset-inline-start: 14px;
    inset-block-start: 14px;
}

.rtl-card--physical {
    padding-left: 18px;
    padding-right: 16px;
    border-left: 3px solid var(--info);
}

.rtl-card--physical .rtl-dot {
    left: 14px;
    top: 14px;
}

.rtl-dot {
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--accent);
}

.rtl-card--physical .rtl-dot {
    background: var(--info);
}

.rtl-title {
    margin: 0 0 6px;
    font-size: 14px;
    font-weight: 700;
}

.rtl-desc {
    margin: 0 0 10px;
    font-size: 12px;
    line-height: 1.7;
    color: var(--text-muted);
}

.rtl-sample {
    margin: 0;
    padding-top: 8px;
    border-top: 1px solid var(--line);
    font-size: 14px;
    color: var(--accent);
}

.rtl-inline {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    font-size: 12px;
    color: var(--text-muted);
}

.rtl-chip {
    display: inline-grid;
    place-items: center;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    font-family: var(--font-mono);
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
    padding-left: 24px;
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.7;
}

.checklist li::before {
    content: '→';
    position: absolute;
    left: 0;
    color: var(--accent);
    font-family: var(--font-mono);
}
</style>
