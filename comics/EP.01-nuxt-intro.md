# EP.01 初识 Nuxt 4

> 对应正文：[第 1 部分 · 起步上手](/01-what-is-nuxt)

## 剧情回顾

- **第 1 格**：标签君接手纯 Vue 项目，临近上线才发现 SEO、SSR、元信息全要自己拼，基础设施吃掉一半工时。
- **第 2 格**：码叔揭示 Nuxt 的定位——Vue 之上的全栈框架，约定优于配置，目录即架构。
- **第 3 格**：像素酱实测 create-nuxt 三分钟起跑，DevTools 随项目自带。
- **第 4 格**：码叔结案：内容站与全栈应用选 Nuxt，框架管基础设施。

## 知识点拆解

### 第 1 格 · 纯 Vue 的边界

Vue 本身是视图层库。做营销页、文档站时，路由要装 vue-router，SEO 要手搓 meta，SSR 要接服务端管线——这些「每个项目都要做一遍」的事，正是 Nuxt 收编的对象。

### 第 2 格 · 约定优于配置

Nuxt 4 的源码默认放在 `app/` 目录：`app/pages/` 下建文件即得路由，`app/components/` 里的组件全局自动导入，`server/api/` 下写文件即得后端接口。Nitro 引擎让同一项目同时产出前端页面与服务端 API。

### 第 3 格 · create-nuxt 与 nuxi

官方脚手架 `npm create nuxt <项目名>` 生成最小骨架；`nuxi` 是 CLI 入口，dev / build / generate / preview / typecheck 都走它。开发期按 Shift + Option + D 可呼出 Nuxt DevTools。

### 第 4 格 · 选型判断

需要 SEO、首屏速度或全栈能力的项目，Nuxt 是默认答案；纯内部后台（不要求 SEO）可用 SPA 模式（`ssr: false`），依然享受约定式目录与自动导入。

## 坑点清单

1. Nuxt 4 把源码目录从项目根迁到了 `app/`，老教程里的 `pages/`、`components/` 裸路径都要加上 `app/` 前缀；
2. Node 版本需 18.20 及以上，老机器先升 Node 再脚手架；
3. `npm run dev` 端口被占时 nuxi 会自动顺延，以终端实际输出为准。

## 自测 3 题（含答案）

1. Nuxt 4 默认源码目录是哪个？——**答案**：`app/`（app.vue、pages、components 等都在其内）。
2. Nuxt 的服务端引擎叫什么？——**答案**：Nitro，负责 dev server、服务端路由与各平台构建产物。
3. 如何让 Nuxt 项目退化为纯 SPA？——**答案**：`nuxt.config.ts` 设置 `ssr: false`。

---

> 返回技术详解：[01. Nuxt 4 全景认知](/01-what-is-nuxt) ｜ [02. 项目初始化与开发环境](/02-scaffolding)
