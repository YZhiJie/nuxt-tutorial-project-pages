# Nuxt LearnHub 学习笔记

配套 Nuxt 4 教程的可运行示例项目：一个带搜索、登录态与管理后台的学习笔记应用。全中文注释，覆盖路由、数据请求、状态管理、服务端 API 等核心能力。

## 技术栈

- Nuxt 4（SSR + Nitro 服务端）
- Pinia 状态管理
- TypeScript + vue-tsc 类型检查
- Vitest 单元测试

## 功能清单

### 页面

| 路径 | 说明 |
| --- | --- |
| `/` | 首页，笔记列表（加载中 / 失败 / 成功三态） |
| `/notes` | 笔记搜索，关键字同步地址栏 `?q=` |
| `/notes/:id` | 笔记详情，动态 SEO，支持删除；id 非数字走 404 |
| `/login` | 登录页（空白布局），演示账号 **demo / nuxt1234** |
| `/dashboard` | 控制台，`auth` 中间件保护，未登录跳转登录页 |
| `/playground` | 游乐场：组件 v-model、composable、Pinia 同页对比 |
| `/admin` | 管理后台，纯客户端渲染（`routeRules` 关闭 SSR） |
| `/about` | 关于页，静态 SEO 示例 |

### 服务端接口

| 方法与路径 | 说明 |
| --- | --- |
| `GET /api/hello` | Nitro 入门接口 |
| `GET /api/notes?q=` | 笔记列表 / 模糊搜索 |
| `POST /api/notes` | 创建笔记（标题必填） |
| `GET /api/notes/:id` | 笔记详情，不存在返回 404 |
| `DELETE /api/notes/:id` | 删除笔记 |
| `POST /api/auth/login` | 登录，写入 httpOnly cookie |
| `POST /api/auth/logout` | 退出登录 |
| `GET /api/auth/me` | 当前登录用户 |

## 目录结构

```
app/
├── app/
│   ├── app.vue              # 根组件：进度条 + 布局 + 页面过渡
│   ├── app.config.ts        # 应用配置（站点名、主题色）
│   ├── error.vue            # 全局错误页
│   ├── assets/css/main.css  # 全局样式与 fade 过渡类
│   ├── components/          # AppHeader / AppFooter / NoteCard / CounterBox
│   ├── composables/         # useCounter / useNotes
│   ├── layouts/             # default / blank
│   ├── middleware/          # auth（具名）/ logger.global（全局）
│   ├── pages/               # 页面路由（含 notes/[id]、admin）
│   ├── plugins/             # 01.hello.client / 02.api
│   ├── stores/              # Pinia：counter（Options）/ user（Setup）
│   └── utils/format.ts      # 纯函数：日期格式化
├── server/
│   ├── api/                 # Nitro 接口（notes / auth / hello）
│   ├── middleware/logger.ts # 请求日志中间件
│   └── utils/notes-store.ts # unstorage 持久化笔记数据
├── shared/types/note.ts     # 前后端共享类型（#shared 别名）
├── tests/format.test.ts     # Vitest 单元测试
├── nuxt.config.ts           # Nuxt 配置（模块 / routeRules / nitro 存储）
└── vitest.config.ts         # 单测配置
```

## 启动步骤

```bash
npm install     # 安装依赖（postinstall 会自动执行 nuxt prepare）
npm run dev     # 启动开发服务器
# 浏览器打开 http://localhost:3000
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 开发模式 |
| `npm run build` | 生产构建 |
| `npm run generate` | 静态站点生成 |
| `npm run preview` | 预览生产构建 |
| `npm run typecheck` | vue-tsc 类型检查 |
| `npm run test` | Vitest 单元测试 |

## 与教程章节的对应关系

| 教程章节（docs/） | 涉及文件 |
| --- | --- |
| 01 快速开始 | `package.json`、`nuxt.config.ts`、`app/app.vue` |
| 02 路由与页面 | `app/pages/**` |
| 03 布局与错误处理 | `app/layouts/**`、`app/error.vue` |
| 04 数据请求与 SSR | `app/pages/index.vue`、`app/composables/useNotes.ts` |
| 05 组件与 props/emits | `app/components/**` |
| 06 状态管理 | `app/stores/**`、`app/pages/playground.vue` |
| 07 服务端 API | `server/api/**`、`server/utils/notes-store.ts` |
| 08 中间件与插件 | `app/middleware/**`、`app/plugins/**` |
| 09 SEO 与元信息 | `app/pages/notes/[id].vue`、`app/pages/about.vue` |
| 10 测试与部署 | `tests/format.test.ts`、`vitest.config.ts` |
