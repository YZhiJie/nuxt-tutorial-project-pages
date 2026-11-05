# EP.04 数据获取之道

> 对应正文：[第 4 部分 · 数据获取](/07-usefetch)

## 剧情回顾

- **第 1 格**：标签君在 onMounted 里取数，首屏白圈转不停，刷新还闪旧数据。
- **第 2 格**：码叔揭秘 useFetch——服务端先取数，结果随 HTML 下发，水合直接复用。
- **第 3 格**：像素酱实测同 key 调用只发一次请求，refresh 一按全员更新。
- **第 4 格**：码叔结案：useFetch 与 $fetch 分工，错误交给 error 兜底。

## 知识点拆解

### 第 1 格 · onMounted 取数的代价

`onMounted` 只在浏览器执行，意味着服务端渲染出的 HTML 里没有任何数据：首屏先白后闪，SEO 抓不到内容，水合前后 DOM 不一致还会触发整屏重绘。

SPA 时代的这个习惯写法，搬到 SSR 框架里就是性能与体验的双重事故。

### 第 2 格 · useFetch 的 SSR 之旅

`useFetch` 在服务端渲染阶段就会执行：Nitro 内网直达接口取到数据，把结果序列化进页面的 payload 里随 HTML 一起下发。客户端水合时直接复用这份数据，不再重复请求。

它等价于 `useAsyncData` 加 `$fetch` 的封装，返回 `data`、`status`、`error`、`refresh` 等响应式引用：

```ts
const { data, status, error } = await useFetch('/api/list')
```

### 第 3 格 · key 与缓存共享

`useFetch` 按 key 缓存结果，URL 默认就是 key。两个组件写同样的调用，网络面板里只有一次真实请求，第二次直接命中缓存。

需要主动刷新时调用返回的 `refresh()`，所有订阅同一 key 的组件会一起更新。跨页面想隔离缓存，就显式指定不同的 key。

### 第 4 格 · 取数分工

页面渲染依赖的数据用 `useFetch`（参与 SSR 与水合）；用户事件触发的动作——提交表单、点按钮——用 `$fetch`（只在事件里发请求）。失败统一看 `error`，`$fetch` 抛错用 try/catch 接住。

## 坑点清单

1. `onMounted` 里取数会让 SSR 输出空内容，水合后闪动，页面数据一律改用 `useFetch`；
2. 不同页面复用同一 URL 但想要独立缓存时，必须显式指定不同 `key`，否则会互相串数据；
3. `$fetch` 失败会直接抛异常，事件处理里记得 try/catch，别把未捕获的 rejection 留给浏览器。

## 自测 3 题（含答案）

1. `useFetch` 的数据如何到达客户端？——**答案**：服务端取数后序列化进 payload 随 HTML 下发，水合时复用。
2. 两个组件同 key 调 `useFetch` 会发几次请求？——**答案**：一次，第二次命中共享缓存。
3. 按钮点击提交表单该用什么？——**答案**：`$fetch`，事件触发的动作不参与 SSR 取数。

---

> 返回技术详解：[07. useFetch 与 useAsyncData](/07-usefetch) ｜ [08. $fetch 与请求进阶](/08-fetch-advanced)
