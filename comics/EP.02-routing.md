# EP.02 路由的约定之力

> 对应正文：[第 2 部分 · 路由系统](/03-file-based-routing)

## 剧情回顾

- **第 1 格**：标签君的新页面忘了在路由表注册，动态参数正则又写错，线上直接 404。
- **第 2 格**：码叔揭秘 Nuxt 的文件路由——app/pages/ 目录即路由表，方括号即动态参数。
- **第 3 格**：像素酱用 navigateTo 与路由中间件，给后台页面加了一道登录锁。
- **第 4 格**：码叔结案：路由、跳转、守卫三件套各司其职。

## 知识点拆解

### 第 1 格 · 手搓路由表的代价

纯 Vue 项目里，每加一个页面都要在路由表里手动注册：import 组件、写 path、配动态段正则。路由表滚到几百行后，「忘了注册」「正则写错」就成了线上事故的高发区。

动态参数如 `/post/:id` 的匹配规则全靠人肉维护，重命名路径还要全局搜索替换，重构成本极高。

### 第 2 格 · 文件即路由

Nuxt 4 只扫描 `app/pages/` 目录：`index.vue` 映射 `/`，`about.vue` 映射 `/about`，`post/[id].vue` 自动成为 `/post/:id` 动态路由，`[...slug].vue` 则是捕获任意多段的 catch-all。

目录结构就是路由表，看一眼文件树就知道全站有哪些页面，天然可审计。动态参数在组件里用 `useRoute().params.id` 读取。

### 第 3 格 · 编程式导航与中间件

跳转首选 `navigateTo`，它在服务端渲染与客户端都安全——SSR 时会正确下发重定向响应。模板内的链接用 `<NuxtLink>`，还会自动预取进入可视区的目标页。

路由守卫写在 `app/middleware/` 目录，用 `defineNuxtRouteMiddleware` 定义，页面里通过 `definePageMeta({ middleware: 'auth' })` 按名引用。未登录就 `return navigateTo('/login')` 中断本次导航。

```ts
export default defineNuxtRouteMiddleware((to) => {
  if (!useCookie('token').value) return navigateTo('/login')
})
```

### 第 4 格 · 三件套分工

目录约定负责「有哪些页面」，navigateTo 负责「怎么去」，中间件负责「能不能去」。三者各管一层，代码里不再出现全局大路由表，新增页面零注册成本。

## 坑点清单

1. 动态路由文件 `[id].vue` 别忘 `.vue` 后缀，少了后缀不会被识别为页面；
2. 中间件里调 `navigateTo` 一定要 `return`，否则导航会继续执行，造成重复跳转；
3. 全局中间件（`.global.ts` 后缀）在每次路由切换都执行，重逻辑慎放，多个全局守卫按文件名顺序执行。

## 自测 3 题（含答案）

1. `app/pages/post/[id].vue` 对应什么路径？——**答案**：`/post/:id` 动态路由，参数用 `useRoute().params.id` 读取。
2. 编程式跳转推荐用什么？——**答案**：`navigateTo`，SSR 与客户端都安全。
3. 如何给某页加登录守卫？——**答案**：在 `app/middleware/auth.ts` 用 `defineNuxtRouteMiddleware` 定义，页面里 `definePageMeta({ middleware: 'auth' })` 引用。

---

> 返回技术详解：[03. 文件路由与动态路由](/03-file-based-routing) ｜ [04. 导航与路由中间件](/04-navigation-middleware)
