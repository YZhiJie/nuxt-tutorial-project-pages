# EP.07 工程化体检

> 对应正文：[第 7 部分 · 工程化](/13-plugins-modules-seo)

## 剧情回顾

- **第 1 格**：像素酱的站点分享没有卡片预览，SDK 塞 window 全局污染，类型报错上线才炸。
- **第 2 格**：码叔亮出三板斧——插件挂 SDK、模块接生态、useSeoMeta 管元信息。
- **第 3 格**：标签君提交前跑 typecheck 与 vitest，全绿后终于睡得着。
- **第 4 格**：码叔结案：插件收口副作用，类型测试守底线。

## 知识点拆解

### 第 1 格 · 质量欠账三宗罪

元信息手贴在 `index.html` 里，各页 og:title 千篇一律，分享链接没有卡片预览；第三方 SDK 直接挂 window，加载时机全凭运气；TypeScript 报错当没看见，上线即翻车。

工程问题不会消失，只会在最忙的时候连本带利讨回来。

### 第 2 格 · 插件、模块与 SEO

需要「在应用启动时做一件事」就用插件：`app/plugins/` 下用 `defineNuxtPlugin` 定义，`.client` / `.server` 后缀限定运行端，`provide` 把实例注入全应用。

生态能力用模块接入——`@pinia/nuxt`、`@nuxtjs/tailwindcss` 等一行注册进 `nuxt.config.ts`。页面元信息交给 `useSeoMeta`，响应式、类型安全，SSR 直出真 HTML：

```ts
useSeoMeta({ ogTitle: '首页', description: '霓虹墨剧场' })
```

### 第 3 格 · 类型检查与测试

Nuxt 会为路由、自动导入、配置自动生成类型，`nuxi typecheck`（底层 vue-tsc）提交前跑一遍，类型错误无所遁形。

单元与组件测试用 vitest 加 `@nuxt/test-utils`，`npx vitest run` 全绿再提交；把两条命令挂进 CI，等于给每次合并上双保险。

### 第 4 格 · 工程化底线

插件收口「启动副作用」，模块复用「生态能力」，SEO 交给「响应式元信息」，类型与测试守住「质量底线」。工程化不是锦上添花，是给未来的自己买保险。

## 坑点清单

1. 插件执行顺序按文件名排，有依赖关系时用数字前缀（`01.foo.ts`、`02.bar.ts`）显式控制；
2. `useSeoMeta` 要放在 `setup` 顶层调用，条件分支里调用会导致元信息不更新；
3. `typecheck` 前先跑 `nuxi prepare` 生成最新类型，否则可能报一堆「找不到模块」的假错。

## 自测 3 题（含答案）

1. 只在浏览器运行的插件怎么命名？——**答案**：加 `.client` 后缀，如 `ga.client.ts`。
2. 页面 og:title 推荐怎么管？——**答案**：`useSeoMeta`，响应式且 SSR 直出真 HTML。
3. Nuxt 项目跑类型检查的命令？——**答案**：`nuxi typecheck`（先 `nuxi prepare` 生成类型）。

---

> 返回技术详解：[13. 插件、模块与 SEO](/13-plugins-modules-seo) ｜ [14. TypeScript 与测试](/14-typescript-testing)
