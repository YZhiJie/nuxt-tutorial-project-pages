# EP.06 服务端全栈

> 对应正文：[第 6 部分 · 服务端与全栈](/11-server-api)

## 剧情回顾

- **第 1 格**：标签君只想查个数据库，却被迫再开 Express 项目，前后端两套仓库折腾部署。
- **第 2 格**：码叔揭秘 server/api/——建文件即得接口，Nitro 让前后端同仓同部署。
- **第 3 格**：像素酱用 useStorage 存数据、httpOnly Cookie 管登录态，一仓完成全栈闭环。
- **第 4 格**：码叔结案：接口、存储、鉴权，Nitro 一手包办。

## 知识点拆解

### 第 1 格 · 两个仓库的成本

小项目拆前后端两个仓库，代价远超想象：跨域配置、接口类型两边各写一遍、联调要对齐双方进度、部署要维护两套流水线。

对「前端为主、接口为辅」的应用，这种拆分是纯粹的过度工程。

### 第 2 格 · Nitro 服务端路由

`server/api/` 下建文件即得接口，文件名后缀限定 HTTP 方法——`hello.get.ts` 只响应 GET。处理器用 `defineEventHandler` 定义，返回值自动序列化为 JSON：

```ts
export default defineEventHandler(() => ({ msg: 'hi from Nitro' }))
```

前端用 `$fetch('/api/hello')` 调用，SSR 期间走内网直达，不经过公网。`server/api/`、`server/middleware/`、`server/plugins/` 都由 Nitro 统一装载。

### 第 3 格 · 存储与 Cookie 鉴权

Nitro 自带 `useStorage`，默认把数据落在 `.data` 目录（kv 语义，生产可换 redis 等驱动），适合存会话、缓存、小体量业务数据。

登录态走 Cookie：`setCookie(event, 'token', jwt, { httpOnly: true })` 设置httpOnly 令牌防 XSS 窃取，后续请求用 `getCookie(event, 'token')` 校验，全栈鉴权闭环在一个项目里完成。

### 第 4 格 · 一仓全栈的边界

Nitro 让小项目单仓全栈：接口、存储、鉴权不再需要第二个服务。但要注意边界——`server/` 下的代码永远不会进浏览器包，密钥只写在这里，才是真正的安全前提。

## 坑点清单

1. `server/` 目录代码不进客户端 bundle，别把前端工具函数放进去，反之前端文件里也别 import 服务端模块；
2. 数据库密码、第三方密钥只能出现在 `server/` 或环境变量的私密部分，任何暴露给客户端的变量都可能被扒走；
3. `useStorage` 默认落盘 `.data` 目录只适合开发与小体量场景，生产环境要换 redis 等外部驱动。

## 自测 3 题（含答案）

1. `server/api/hello.get.ts` 提供什么接口？——**答案**：`/api/hello` 的 GET 接口，文件名后缀限定方法。
2. SSR 期间前端调自己的 API 走什么链路？——**答案**：Nitro 内网直达，不经过公网回环。
3. 登录令牌为什么用 httpOnly Cookie？——**答案**：JS 读不到 httpOnly Cookie，可防 XSS 窃取令牌。

---

> 返回技术详解：[11. Nitro 服务端 API](/11-server-api) ｜ [12. 全栈实战：存储与鉴权](/12-fullstack)
