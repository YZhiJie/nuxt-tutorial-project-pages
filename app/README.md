# Nuxt 企业工程练功房

一个可运行的企业级 Nuxt 4 知识库：把前端交付链路拆成 **20 个业务模块**，每个模块都包含原理说明、可交互演示、常见坑与落地清单。全中文注释，适合作为团队内训、技术选型参考与项目脚手架。

> 技术栈：Nuxt 4 · Vue 3.5 · Nitro · Pinia · TypeScript · Vitest

## 快速开始

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm typecheck  # vue-tsc 全量类型检查
pnpm test       # Vitest 单元测试
pnpm build      # Nitro 生产构建
pnpm preview    # 预览生产产物
```

演示账号：`demo / nuxt1234`（认证模块使用 httpOnly Cookie 会话）。

## 知识地图

| # | 模块 | 入口 | 覆盖要点 |
| --- | --- | --- | --- |
| 01 | 路由与导航 | `/routing` | 动态段、通配段、路由组、嵌套布局、编程式导航 |
| 02 | 渲染策略 | `/rendering` | SSR / SSG / ISR(SWR) / CSR、混合渲染决策 |
| 03 | 数据获取与缓存 | `/data` | `useFetch` / `useAsyncData`、key 去重、服务端 API、缓存失效 |
| 04 | 状态管理 | `/state` | `useState`、Pinia、URL 即状态、服务端状态边界 |
| 05 | 组件体系 | `/components` | props / emits / slots、v-model、异步组件、组件规范 |
| 06 | 表单与变更 | `/forms` | 表单建模、双层校验、乐观更新与回滚 |
| 07 | 认证与会话 | `/auth` | httpOnly Cookie 会话、路由守卫、RBAC |
| 08 | 安全防线 | `/security` | 安全响应头、限流、IDOR、上传防护、SSRF |
| 09 | 可观测性 | `/observability` | requestId 链路、Prometheus 指标、SLO / 错误预算 |
| 10 | 性能优化 | `/performance` | 懒加载、水合与预取、构建产物分析 |
| 11 | SEO 与元数据 | `/seo` | `useSeoMeta`、JSON-LD、sitemap / robots |
| 12 | 国际化 | `/i18n` | 语言协商、消息表、RTL 逻辑属性 |
| 13 | PWA 与离线 | `/pwa` | Service Worker、缓存策略、离线兜底 |
| 14 | 实时通信 | `/realtime` | SSE 单向推送、WebSocket 房间与重连 |
| 15 | AI 集成 | `/ai` | 流式输出、结构化输出、RAG 检索评估 |
| 16 | 全栈数据层 | `/fullstack` | Nitro KV CRUD、状态机、幂等、事务与 Outbox |
| 17 | 测试体系 | `/testing` | 单元 / 组件 / 接口 / E2E 金字塔 |
| 18 | 主题与设计系统 | `/theming` | 语义 token、暗色模式、多主题换肤 |
| 19 | 无障碍 | `/accessibility` | skip link、landmark、焦点陷阱、reduced-motion |
| 20 | 部署与运维 | `/deployment` | 部署目标矩阵、发布检查单、回滚手册 |

首页 `/` 提供模块搜索（按 `/` 聚焦）与模块卡片；每个模块页右侧/顶部有同模块页面导航与上一篇 / 下一篇。

## 目录结构

```text
app/
├── app/
│   ├── app.vue / app.config.ts / error.vue
│   ├── assets/css/main.css          # 设计 token + 明暗主题 + 工具类
│   ├── components/
│   │   ├── docs/                    # DocPage / DocSection / CodeBlock / Callout / DemoCard / ModuleCard
│   │   ├── layout/                  # DocsHeader / DocsSidebar / DocsFooter
│   │   ├── demo/                    # 交互演示组件（ProfileCard / FocusModal / perf/...）
│   │   └── ...
│   ├── composables/
│   │   ├── useTheme.ts              # 主题状态 + 持久化
│   │   ├── useDocsNav.ts            # 当前模块 / 上下页
│   │   ├── useDocMeta.ts            # 统一 SEO 元信息
│   │   ├── auth/useAuth.ts
│   │   ├── lab/useCounter.ts
│   │   └── i18n/useLocale.ts
│   ├── layouts/                     # default（首页）/ docs（文档站）/ admin / blank
│   ├── middleware/                  # logger.global / auth
│   ├── pages/                       # 按业务域使用路由组 (routing) (rendering) ...
│   ├── plugins/                     # 03.theme.client（首屏主题）
│   ├── stores/                      # auth / lab（Pinia 子目录自动导入）
│   └── utils/                       # format / api-error
├── server/
│   ├── api/                         # 按模块分域：rendering / forms / security / ...
│   ├── middleware/                  # logger / auth / observability
│   └── utils/                       # notes / auth / fullstack / observability
├── shared/
│   ├── knowledge/modules.ts         # 全站模块注册表（导航、首页、上下页唯一数据源）
│   ├── types/                       # note / auth / admin / order / fullstack-item
│   └── utils/notes-stats.ts
├── docs/
│   ├── adr/                         # 架构决策记录
│   └── runbooks/                    # 发布 / 事故处置手册
├── public/                          # favicon / sw.js / manifest.webmanifest
├── tests/                           # Vitest 单元测试
├── nuxt.config.ts
└── vitest.config.ts
```

### 架构约定

1. **一个模块 = 一个路由组 + 一个注册表条目**。新增模块只需在路由组下建页，并在 `shared/knowledge/modules.ts` 注册，首页、侧边栏、上下页与 SEO 自动生效。
2. **页面外壳统一由 `DocPage` 提供**：面包屑、标题、标签、模块内导航、上一篇 / 下一篇、统一 SEO 全部收口。
3. **文档组件全局自动注册**（`components: [{ path: '~/components', pathPrefix: false }]`），文件名即组件名，因此文件名必须唯一。
4. **服务端按业务域分目录**，与前端模块同名，便于前后端一起演进；共享类型放 `shared/types`，通过 `#shared/types/*` 引入。
5. **演示优先使用真实接口**：限流、IDOR、SSE、流式 AI、订单状态机均可直接调用 Nitro 接口，而不是纯静态截图。

## 关键接口

| 方法与路径 | 说明 |
| --- | --- |
| `GET /api/hello` | Nitro 入门 / 健康检查 |
| `GET /api/notes?q=` · `POST /api/notes` · `GET/DELETE /api/notes/:id` | 笔记 CRUD（数据模块与表单模块共享） |
| `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` | Cookie 会话 |
| `GET /api/admin/stats` | 需登录的后台统计（服务端中间件鉴权） |
| `GET /api/rendering/clock` · `GET /api/rendering/catalog` | SSR 实时数据 / ISR 缓存数据 |
| `POST /api/forms/validate` | 服务端二次校验（422 + 字段错误） |
| `GET /api/security/rate-limit` | 5 次 / 10 秒固定窗口限流 |
| `GET /api/security/records/:id` | 对象级授权（IDOR 演示） |
| `GET /api/observability/echo` · `GET /api/observability/metrics` | requestId 回显 / Prometheus 指标 |
| `GET /api/realtime/sse` | SSE 时间事件流 |
| `POST /api/ai/stream` · `POST /api/ai/structured` | 流式对话 / 结构化输出 |
| `GET/POST /api/fullstack/items` · `DELETE /api/fullstack/items/:id` | KV 存储 CRUD |
| `GET/POST /api/fullstack/orders` · `POST /api/fullstack/orders/:id/transition` | 订单状态机 + 幂等键 |

## 工程实践清单

- **渲染**：在 `nuxt.config.ts` 的 `routeRules` 中按路由设置 `prerender` / `swr` / `ssr`；内容页静态化，个性化页面保持 SSR。
- **数据**：`useFetch` 必须显式 `key`，避免重复请求；服务端数据不复制进 Pinia。
- **安全**：`/security/headers` 路由已注入 `X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Permissions-Policy`；生产环境补 CSP 与 HSTS。
- **可观测性**：`server/middleware/observability.ts` 为每个请求生成 `x-request-id`，并采集 RED 指标；`/api/observability/metrics` 输出 Prometheus 文本。
- **全栈**：`/fullstack/enterprise` 演示 `draft → paid → shipped → closed` 状态机、非法流转 409、`Idempotency-Key` 重放。
- **测试**：`pnpm test` 覆盖共享纯函数；组件、接口与 E2E 的落地方式见 `/testing`。
- **无障碍**：全站支持键盘焦点、`prefers-reduced-motion`、skip link 与对话框焦点陷阱。

## 文档

- [架构决策记录](docs/adr/0001-knowledge-site-architecture.md)
- [渲染与缓存决策](docs/adr/0002-rendering-and-cache.md)
- [认证与安全基线](docs/adr/0003-auth-and-security.md)
- [发布与回滚手册](docs/runbooks/deploy-and-rollback.md)
- [事故响应手册](docs/runbooks/incident-response.md)

## 扩展方式

1. 在 `app/pages/(<domain>)/<domain>/` 新建页面，并 `definePageMeta({ layout: 'docs' })`。
2. 在 `shared/knowledge/modules.ts` 对应模块的 `demos` 数组登记 `{ name, href, desc, kind }`。
3. 如需接口，在 `server/api/<domain>/` 新建 Nitro 文件路由；共享类型放 `shared/types/`。
4. 需要交互组件时放 `app/components/demo/`，文件名以 `Demo` 开头并保持全站唯一。

不需要额外配置，首页、侧边栏、模块导航与上一篇 / 下一篇会自动更新。
