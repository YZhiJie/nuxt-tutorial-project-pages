<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const GROUPS = [
    { path: '.output/public/_nuxt/', content: '入口 chunk、page chunk、Lazy 组件 chunk、CSS', action: '找首屏最大 chunk 与重复依赖' },
    { path: '.output/public/_nuxt/builds/', content: '构建清单、manifest、增量更新元数据', action: '一般不直接改，确认发布时完整同步' },
    { path: '.output/server/', content: 'Nitro 服务端产物（接口、渲染、依赖）', action: '关注服务端依赖是否异常膨胀' },
    { path: '.output/public/', content: 'favicon、robots、sitemap、静态图片', action: '检查大图、未压缩资源与重复文件' },
];

const COMMANDS = `# 1) 可视化产物构成（按提示安装分析依赖）
npx nuxi analyze

# 2) 构建后直接看目录体积
du -sh .output/public/_nuxt
ls -lh .output/public/_nuxt | sort -k5 -h | tail -20

# 3) 搜索某个依赖是否被打包
rg -l "chart.js" .output/public/_nuxt

# 4) 查看某个 chunk 的源码映射（需开启 sourcemap）
#    在分析工具里定位到具体模块与引用链`;

const DYNAMIC_CODE = `// 重型依赖只在用到时下载
const loadChartLib = () => import('chart.js/auto');

// 组件级动态导入
import { defineAsyncComponent } from 'vue';

const ChartPanel = defineAsyncComponent(
    () => import('~/components/demo/perf/DemoPerfHeavyPanel.vue'),
);

// 常见错误：在模块顶层同步 import 整个图标库 / 工具库
// import _ from 'lodash';        // 可能把整库打进入口
// import * as icons from '...';  // 把几百个图标全部打包`;

const ASSET_CODE = `<!-- 首屏大图：给出尺寸与实际分辨率，避免布局抖动 -->
<img
    src="/hero-960.webp"
    srcset="/hero-480.webp 480w, /hero-960.webp 960w, /hero-1440.webp 1440w"
    sizes="(max-width: 720px) 100vw, 960px"
    width="960"
    height="480"
    fetchpriority="high"
    alt="产品界面截图"
>

<!-- 非首屏图片：懒加载 + 异步解码 -->
<img src="/screenshot.webp" width="800" height="450" loading="lazy" decoding="async" alt="">

<!-- 字体：woff2 + 子集化 + 仅预加载真正用到的字重 -->
<link
    rel="preload"
    href="/fonts/inter-latin-400.woff2"
    as="font"
    type="font/woff2"
    crossorigin
>`;

const CHECKLIST = [
    '先看首屏入口 chunk，再看全站总量；首屏之外的体积可以通过懒加载解决。',
    '同一依赖出现在多个 chunk 时，检查是否被重复打包或在插件里同步引入。',
    '禁止整库引入：图标、工具函数、图表库都按需导入或动态 import。',
    '字体只保留实际使用的字重与字符集，优先 woff2，并设置 font-display: swap。',
    '图片写死宽高并使用 WebP / AVIF；首屏图可提高优先级，非首屏图一律 lazy。',
    '每次发布对比产物体积，设置预算阈值，超出时在 CI 中失败而不是事后补救。',
];
</script>

<template>
    <DocPage
        title="构建分析"
        description="构建产物揭示性能问题的来源：哪个 chunk 最大、依赖为什么被重复打包、字体和图片是否拖慢首屏。本页给出一套从产物地图到检查单的排查流程。"
        :tags="['nuxi analyze', '.output', '依赖体积', '动态导入', '图片', '字体']"
    >
        <DocSection id="map" title="产物地图" kicker="01 · OUTPUT MAP">
            <p class="body-text">
                Nuxt 构建后，客户端产物在 <code>.output/public/</code>，
                服务端在 <code>.output/server/</code>。排查看的是“谁进了首屏链路”，
                而不是单纯比较目录总大小。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>路径</th><th>内容</th><th>排查重点</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in GROUPS" :key="row.path">
                            <td class="mono">{{ row.path }}</td>
                            <td>{{ row.content }}</td>
                            <td>{{ row.action }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="COMMANDS" lang="bash" title="包分析与体积检查命令" />
            <Callout type="tip" title="先定位引用链">
                体积大不等于问题大。真正要回答的是：这个模块为什么进入首屏入口？
                是全局插件、布局、还是首屏页面同步 import 了它？
            </Callout>
        </DocSection>

        <DocSection id="dependencies" title="依赖体积排查与动态导入" kicker="02 · DEPENDENCIES">
            <p class="body-text">
                依赖膨胀通常来自三类写法：整库同步引入、同一依赖被多个 chunk 重复打包、
                把只在低频功能里用到的重库放进入口。动态导入把后两者移出首屏。
            </p>
            <CodeBlock :code="DYNAMIC_CODE" lang="ts" title="把重依赖移出同步链路" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>症状</th><th>可能原因</th><th>处理</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>入口 chunk 异常大</td><td>全局插件同步 import 重库</td><td>改为动态 import 或移到组件内部</td></tr>
                        <tr><td>多个 chunk 含同一库</td><td>不同页面分别 import 同一依赖</td><td>统一收口到 composable，避免重复打包</td></tr>
                        <tr><td>首屏出现低频功能代码</td><td>所有弹窗 / 编辑器写在同一页面</td><td>拆分组件并用 Lazy 前缀</td></tr>
                        <tr><td>依赖树里有重复版本</td><td>多个包依赖同一库的不同版本</td><td>通过包管理器 overrides 对齐版本</td></tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="assets" title="图片与字体" kicker="03 · ASSETS">
            <p class="body-text">
                图片与字体经常比业务代码更影响首屏。核心原则：尺寸匹配显示区域、
                使用现代格式、给出宽高避免布局抖动、只预加载真正关键的文件。
            </p>
            <CodeBlock :code="ASSET_CODE" lang="html" title="图片与字体的关键属性" />
            <div class="grid grid--two">
                <div class="mini-card">
                    <h3>图片</h3>
                    <p>WebP / AVIF 优先，srcset 按屏幕提供多尺寸；首屏图 fetchpriority="high"，其余 lazy。</p>
                </div>
                <div class="mini-card">
                    <h3>字体</h3>
                    <p>woff2 + 子集化；限制字重数量；font-display: swap 避免文字长时间不可见。</p>
                </div>
            </div>
        </DocSection>

        <DocSection id="checklist" title="发布检查单" kicker="04 · CHECKLIST">
            <ul class="checklist">
                <li v-for="item in CHECKLIST" :key="item">{{ item }}</li>
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

.mini-card {
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
}

.mini-card h3 {
    margin: 0 0 6px;
    font-size: 14px;
}

.mini-card p {
    margin: 0;
    font-size: 13px;
    line-height: 1.65;
    color: var(--text-muted);
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
    line-height: 1.7;
    color: var(--text-muted);
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
