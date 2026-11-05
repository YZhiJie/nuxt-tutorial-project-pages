# EP.05 状态不串号

> 对应正文：[第 5 部分 · 状态管理](/09-usestate)

## 剧情回顾

- **第 1 格**：像素酱把登录态塞进模块级 ref，同事一刷新，页面显示别人的名字。
- **第 2 格**：码叔揭秘 useState——按 key 管状态，SSR 序列化下发，每个请求各拿各的。
- **第 3 格**：标签君引入 Pinia 写购物车 store，还能在 DevTools 里时光旅行。
- **第 4 格**：码叔结案：轻量 useState，复杂 Pinia，模块级 ref 是禁区。

## 知识点拆解

### 第 1 格 · 模块级 ref 的串号事故

服务端渲染时，Node 进程里的模块只加载一次。把共享状态写成模块顶层 `ref`，等于让同一份状态服务所有请求：A 用户的登录态会残留到 B 用户的响应里。

这是 SSR 应用最危险的一类 bug——不是页面错乱，而是隐私数据串号泄露。

### 第 2 格 · useState 的隔离之道

`useState(key, init)` 是 SSR 友好的共享状态：每个请求都会独立执行初始化函数，结果序列化进 payload 随页面下发，客户端水合后接管同一份值。

```ts
const user = useState('user', () => null)
```

同 key 在任何组件、composable 里访问的都是同一份状态，请求与请求之间天然隔离。

### 第 3 格 · Pinia 工程化状态

状态多了就上 Pinia：安装 `@pinia/nuxt` 模块后自动注册，`stores/` 目录下用 `defineStore` 定义即可。Pinia 在 Nuxt 里同样 SSR 安全，还附赠 DevTools 时间旅行调试。

```ts
export const useCart = defineStore('cart', {
  state: () => ({ items: [] })
})
```

### 第 4 格 · 状态分层选型

跨组件轻量共享（当前用户、主题）用 `useState` 就够；有复杂派生、动作、持久化需求的业务（购物车、表单向导）用 Pinia。唯一的禁区是模块级可变状态，SSR 下必踩。

## 坑点清单

1. 模块顶层 `ref`/`reactive` 在 SSR 下跨请求共享，必然串号，一律改 `useState`；
2. `useState` 的初值要可序列化（会被 JSON 化进 payload），别放函数、Map、类实例；
3. 水合前后状态不一致时，先查是否该用 `clearNuxtState` 清理残留 key，再查初始化时机。

## 自测 3 题（含答案）

1. 为什么模块级 ref 在 SSR 下危险？——**答案**：服务端模块只加载一次，状态跨请求残留，导致用户间串号。
2. `useState` 凭什么 SSR 安全？——**答案**：每次请求独立初始化，结果随 payload 下发并在水合时接管。
3. Nuxt 里怎么用 Pinia？——**答案**：装 `@pinia/nuxt` 模块后，在 `stores/` 目录用 `defineStore` 定义即可，自动注册。

---

> 返回技术详解：[09. useState 与 SSR 状态](/09-usestate) ｜ [10. composables 与 Pinia](/10-composables-pinia)
