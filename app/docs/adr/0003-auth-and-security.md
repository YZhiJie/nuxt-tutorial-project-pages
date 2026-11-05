# ADR-0003：认证、授权与安全基线

- 状态：Accepted
- 日期：2026-10-30
- 决策人：安全组 / 前端架构组

## 背景

示例站点包含登录、后台统计、限流、对象级资源与文件上传。若只在前端做权限判断，任何用户都可以直接调用接口；若把令牌写入 `localStorage`，XSS 即可窃取会话。

## 决策

### 认证

- 使用 **httpOnly + SameSite=Lax Cookie** 保存会话，令牌不暴露给 JavaScript。
- 登录成功后由服务端 `setCookie`，前端只读取 `/api/auth/me` 的非敏感用户字段。
- 写操作要求同源来源校验或 CSRF Token；`SameSite` 是兜底而非唯一防线。

### 授权

- **服务端二次校验**：页面守卫只负责体验，接口必须独立校验。
- **RBAC + 资源级授权**：角色决定动作集合，资源归属决定单条记录可见性（见 `/security/idor`）。
- 401 表示未认证，403 表示已认证但无权限；不要用 404 掩盖所有拒绝，避免排障困难。

### 安全响应头

通过 `routeRules.headers` 注入：

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

生产环境追加 CSP 与 HSTS，CSP 先以 `Report-Only` 灰度，避免直接阻断业务脚本。

### 输入与出站

- 上传：大小、MIME、magic bytes、文件名净化、服务端二次校验。
- 出站请求：URL 白名单 + 私网网段拦截，防 SSRF。
- 限流：固定窗口先落地，再演进为滑动窗口 / 令牌桶；429 必须带 `Retry-After`。

## 后果

- 会话安全性与前端 XSS 影响面显著降低。
- 页面需要处理 401 / 403 两种状态，登录跳转与权限提示要分开。
- CSP 上线需要排查内联脚本、第三方 SDK 与图片域名，发布节奏要预留灰度窗口。
- 限流与对象级校验会增加一次查询或缓存读取，需要在接口层设计索引与缓存。

## 备选方案

- **JWT 存 localStorage**：实现简单但 XSS 风险高，且无法可靠注销。
- **仅前端路由守卫**：不构成安全边界。
- **全局统一 404 拒绝**：安全但不可观测，排障成本高。
