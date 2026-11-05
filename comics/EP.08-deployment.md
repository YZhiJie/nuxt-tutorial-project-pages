# EP.08 构建与部署

> 对应正文：[第 8 部分 · 构建与部署](/15-build-prerender)

## 剧情回顾

- **第 1 格**：标签君的博客全走 SSR，流量一高峰就告警，十年不变的文档页也在烧服务器。
- **第 2 格**：码叔揭秘 routeRules 混合渲染——首页预渲染、后台 SPA、博客 ISR。
- **第 3 格**：像素酱实测 build、generate、NITRO_PRESET 三条部署路径。
- **第 4 格**：码叔结案：渲染策略按页定制，产物跟着 preset 走。

## 知识点拆解

### 第 1 格 · 全站 SSR 的账单

SSR 的每一次请求都要在服务端跑一遍渲染，CPU 随流量线性上涨。营销页、文档站这类内容几乎不变的页面，每次请求都重新渲染纯属浪费。

渲染模式不该是全站一刀切，而应按页面粒度选择：变的走 SSR，不变的走静态。

### 第 2 格 · routeRules 混合渲染

`nuxt.config.ts` 里的 `routeRules` 按路径声明渲染模式，这是 Nuxt 的杀手锏：

```ts
routeRules: {
  '/': { prerender: true },
  '/admin/**': { ssr: false },
  '/blog/**': { isr: 3600 }
}
```

`prerender` 构建时生成静态 HTML；`ssr: false` 退化为客户端渲染的 SPA 区；`isr` 增量静态再生——先给缓存，过期后后台重建，秒级响应与内容新鲜兼得。

### 第 3 格 · 三条部署路径

`nuxi build` 产出 Node 服务的 `.output` 目录，自带服务器，拷走即跑；`nuxi generate` 产出纯静态站点，可扔任何对象存储与 CDN；设 `NITRO_PRESET=vercel`（或 netlify、cloudflare 等）再 build，产物自动适配对应平台。

环境变量分两类：`NUXT_PUBLIC_` 前缀的会暴露给客户端，其余只留在服务端——私密配置永远不要加 PUBLIC 前缀。

### 第 4 格 · 按页定模式

渲染策略按页定制省钱，preset 定产物去处省事，密钥留服务端保命。部署不再是「选一个模式全站服从」，而是「每页选最合适的模式」。

## 坑点清单

1. `nuxi generate` 之后 `server/api/` 全部失效，纯静态站没有服务端，需要接口就别走 generate；
2. `routeRules` 多条规则命中同一路径时按优先级生效，通配符规则写之前先查清匹配顺序；
3. 运行时环境变量以 `NUXT_` 开头覆盖配置，客户端可见的只有 `NUXT_PUBLIC_` 前缀那部分。

## 自测 3 题（含答案）

1. ISR 是什么？——**答案**：增量静态再生，先返回静态缓存，过期后后台重建该页。
2. 后台管理区不想走 SSR 怎么配？——**答案**：`routeRules` 里 `'/admin/**': { ssr: false }`。
3. 想让构建产物适配 Vercel 怎么做？——**答案**：设 `NITRO_PRESET=vercel` 再执行 `nuxi build`。

---

> 返回技术详解：[15. 构建与预渲染策略](/15-build-prerender) ｜ [16. 部署上线全攻略](/16-deploy)
