# EP.03 组件与布局

> 对应正文：[第 3 部分 · 视图与组件](/05-components)

## 剧情回顾

- **第 1 格**：像素酱的页面 import 堆了二十行，改组件名要全局搜替换，布局复制到第三遍。
- **第 2 格**：码叔揭秘自动导入与布局约定——components 免导入，layouts 按名套用。
- **第 3 格**：标签君用 definePageMeta 一行换布局，顺手加上渐隐过渡。
- **第 4 格**：码叔结案：约定省导入，布局管骨架。

## 知识点拆解

### 第 1 格 · import 地狱

手动管理组件导入的痛点有三：相对路径 `../../` 层数靠数；组件改名要全局搜索替换；每个页面重复 import 同一批基础组件。布局更惨——header、footer 各页复制一份，改版时漏改一处就是事故。

这些都不是业务问题，却实打实吃掉开发时间。

### 第 2 格 · 自动导入与布局约定

`app/components/` 下的组件全局免导入，模板里直接写标签即可。目录嵌套会反映到组件名：`components/App/Header.vue` 对应 `<AppHeader />`，天然避免重名。

`app/layouts/` 下的布局按文件名注册，`default.vue` 默认套住所有页面。布局组件里用 `<slot />` 渲染页面内容，骨架只写一份，全站统一。

### 第 3 格 · definePageMeta 与页面过渡

页面想换布局、加过渡，不用动模板，声明一行 meta 即可：

```vue
<script setup>
definePageMeta({
  layout: 'admin',
  pageTransition: { name: 'fade', mode: 'out-in' }
})
</script>
```

组件通信照旧：`defineProps` 声明入参、`defineEmits` 声明事件、插槽留出内容空洞。这些编译宏在 Nuxt 里同样自动可用，无需 import。

### 第 4 格 · 约定收口

自动导入消灭样板 import，布局系统收口页面骨架，页面过渡一行声明。三者的共同点是「约定替代配置」：把重复决策交给框架，把创造力留给业务。

## 坑点清单

1. 同名组件靠目录前缀区分（如 `<AppHeader />` 与 `<UserHeader />`），重名冲突时 Nuxt 会按前缀消解，别让两份组件同名同目录；
2. 自定义 layout 里必须放 `<slot />`，否则页面内容渲染不出来；
3. `pageTransition` 的 `name` 对应 CSS 类名（如 `fade-enter-active`），忘了写样式就没有过渡效果。

## 自测 3 题（含答案）

1. `app/components/App/Header.vue` 在模板里怎么用？——**答案**：直接写 `<AppHeader />`，无需 import。
2. 页面如何切换到 admin 布局？——**答案**：`definePageMeta({ layout: 'admin' })`。
3. 布局组件靠什么渲染页面内容？——**答案**：`<slot />` 插槽。

---

> 返回技术详解：[05. 组件开发与自动导入](/05-components) ｜ [06. 布局系统与页面过渡](/06-layouts)
