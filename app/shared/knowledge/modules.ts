/**
 * 知识模块注册表：全站唯一数据源。
 *
 * 首页用它渲染模块卡片，文档侧边栏用它生成导航，
 * DocPage 用它计算上一页 / 下一页，页面标题也由这里兜底。
 * 新增模块或子页面时，只需要改这一个文件。
 */

export type DemoKind = 'live' | 'docs' | 'api';

export interface Demo {
    /** 页面标题 */
    name: string;
    /** 路由地址（以 / 开头） */
    href: string;
    /** 一句话说明，首页搜索与卡片会展示 */
    desc: string;
    /** live = 可交互演示，api = 接口演示，docs = 讲解页 */
    kind: DemoKind;
}

export interface Module {
    /** 模块 key，同时是路由前缀 */
    key: string;
    /** 侧边栏 / 首页标题 */
    title: string;
    /** 两字缩写，用于卡片角标 */
    mark: string;
    /** 模块定位，一句话 */
    brief: string;
    /** 学习目标 */
    goal: string;
    /** 模块内页面，按阅读顺序排列 */
    demos: Demo[];
}

export const MODULES: Module[] = [
    {
        key: 'routing',
        title: '路由与导航',
        mark: 'RT',
        brief: '文件系统路由的全部段类型',
        goal: '掌握动态段、通配段、路由组、嵌套布局与编程式导航。',
        demos: [
            { name: '动态路由参数', href: '/routing/dynamic', desc: '动态段、参数校验、404 兜底与 SEO 联动', kind: 'live' },
            { name: '通配路由', href: '/routing/catch-all', desc: '剩余段匹配、零段行为与文件优先级', kind: 'live' },
            { name: '路由组与嵌套布局', href: '/routing/layouts', desc: '路由组不参与 URL，布局按业务域嵌套', kind: 'live' },
            { name: '编程式导航', href: '/routing/navigation', desc: 'navigateTo / router.push / 重定向与滚动行为', kind: 'docs' },
        ],
    },
    {
        key: 'rendering',
        title: '渲染策略',
        mark: 'RM',
        brief: 'SSR / SSG / ISR / SWR / CSR 的取舍',
        goal: '按内容变化频率与个性化程度选择渲染模式，并用 routeRules 混合落地。',
        demos: [
            { name: 'SSR 实时渲染', href: '/rendering/ssr', desc: '每请求渲染：实时仪表盘与个性化内容', kind: 'live' },
            { name: 'SSG 静态生成', href: '/rendering/ssg', desc: '构建期冻结：文档、营销页与增量更新', kind: 'live' },
            { name: 'ISR / SWR 增量再生', href: '/rendering/isr', desc: 'routeRules 周期再生与事件失效双通道', kind: 'live' },
            { name: '混合渲染决策', href: '/rendering/hybrid', desc: '同一站点按路由选择策略的决策矩阵', kind: 'docs' },
        ],
    },
    {
        key: 'data',
        title: '数据获取与缓存',
        mark: 'DT',
        brief: 'useFetch / useAsyncData 与缓存键',
        goal: '理解 SSR 下的数据同构、请求去重、缓存键与失效策略。',
        demos: [
            { name: 'useFetch 与 useAsyncData', href: '/data/use-fetch', desc: '并行 / 依赖请求、key 去重、懒加载与错误态', kind: 'live' },
            { name: '服务端 API 与类型契约', href: '/data/server-api', desc: 'Nitro 文件路由、校验、错误码与共享类型', kind: 'api' },
            { name: '缓存与失效', href: '/data/cache', desc: '请求去重、缓存 key、手动刷新与存储层', kind: 'docs' },
        ],
    },
    {
        key: 'state',
        title: '状态管理',
        mark: 'ST',
        brief: 'useState / Pinia / URL 状态',
        goal: '区分组件状态、跨组件共享状态与服务端状态，选对承载方式。',
        demos: [
            { name: 'useState 与共享状态', href: '/state/use-state', desc: 'SSR 安全的作用域、跨组件共享与重置', kind: 'live' },
            { name: 'Pinia 领域 Store', href: '/state/pinia', desc: 'Setup / Options 两种写法、派生状态与订阅', kind: 'live' },
            { name: 'URL 即状态', href: '/state/url', desc: '查询参数同步、可分享视图与前进后退', kind: 'live' },
        ],
    },
    {
        key: 'components',
        title: '组件体系',
        mark: 'CP',
        brief: 'props / emits / slots 与异步组件',
        goal: '设计可复用组件 API，掌握异步组件、懒加载与客户端组件边界。',
        demos: [
            { name: 'Props / Emits / Slots', href: '/components/props-slots', desc: 'v-model 双向绑定、具名插槽与作用域插槽', kind: 'live' },
            { name: '异步与懒加载组件', href: '/components/async', desc: 'Lazy 前缀、hydration 边界与性能收益', kind: 'live' },
            { name: '组件设计规范', href: '/components/patterns', desc: '受控 / 非受控、复合组件与可访问性默认值', kind: 'docs' },
        ],
    },
    {
        key: 'forms',
        title: '表单与变更',
        mark: 'FM',
        brief: '双向绑定、校验与乐观更新',
        goal: '从表单建模、客户端校验到服务端二次校验与乐观更新完整链路。',
        demos: [
            { name: 'v-model 与表单建模', href: '/forms/v-model', desc: '多字段、修饰符、脏值与重置', kind: 'live' },
            { name: '双层校验', href: '/forms/validation', desc: '客户端即时反馈 + 服务端 Zod 兜底', kind: 'live' },
            { name: '乐观更新', href: '/forms/optimistic', desc: '先渲染后确认、失败回滚与并发控制', kind: 'live' },
        ],
    },
    {
        key: 'auth',
        title: '认证与会话',
        mark: 'AU',
        brief: 'Cookie 会话、中间件与 RBAC',
        goal: '建立 httpOnly 会话、路由守卫与基于角色的访问控制。',
        demos: [
            { name: 'Cookie 会话登录', href: '/auth/login', desc: '登录、退出、会话读取与 CSRF 要点', kind: 'live' },
            { name: '路由守卫', href: '/auth/middleware', desc: '全局 / 具名中间件与登录跳转', kind: 'docs' },
            { name: 'RBAC 权限模型', href: '/auth/rbac', desc: '角色矩阵、资源级授权与 403 / 401 区分', kind: 'live' },
        ],
    },
    {
        key: 'security',
        title: '安全防线',
        mark: 'SC',
        brief: '构建期 / 运行期 / 传输层三道防线',
        goal: '覆盖安全响应头、限流、越权、上传与出站请求防护。',
        demos: [
            { name: '安全响应头与 CSP', href: '/security/headers', desc: 'routeRules 注入 HSTS / CSP / nosniff', kind: 'docs' },
            { name: '接口限流', href: '/security/rate-limit', desc: '固定窗口、429 + Retry-After 与内存降级', kind: 'live' },
            { name: 'IDOR 对象级授权', href: '/security/idor', desc: '资源归属校验，拦截同会话越权', kind: 'live' },
            { name: '上传防护与 SSRF', href: '/security/upload', desc: 'magic bytes 校验、文件名净化与出站白名单', kind: 'docs' },
        ],
    },
    {
        key: 'observability',
        title: '可观测性',
        mark: 'OB',
        brief: '日志、指标与 SLO 闭环',
        goal: '用 requestId 串起请求链路，暴露指标并建立错误预算告警。',
        demos: [
            { name: '请求上下文与日志', href: '/observability/request-id', desc: 'requestId 贯穿 Server → DB → Action', kind: 'live' },
            { name: 'Prometheus 指标', href: '/observability/metrics', desc: 'RED 指标、SLO gauge 与文本格式输出', kind: 'api' },
            { name: 'SLO 运营面板', href: '/observability/slo', desc: '错误预算、超阈值告警与行动手册', kind: 'live' },
        ],
    },
    {
        key: 'performance',
        title: '性能优化',
        mark: 'PF',
        brief: 'Bundle、懒加载与预取策略',
        goal: '从构建产物、组件懒加载到数据预取，系统性降低首屏成本。',
        demos: [
            { name: '组件懒加载', href: '/performance/lazy', desc: 'Lazy 前缀、交互时加载与体积对照', kind: 'live' },
            { name: '水合与预取', href: '/performance/hydration', desc: 'SSR 水合成本、预取矩阵与关键路径', kind: 'docs' },
            { name: '构建分析', href: '/performance/bundle', desc: '产物分组、依赖体积与优化清单', kind: 'docs' },
        ],
    },
    {
        key: 'seo',
        title: 'SEO 与元数据',
        mark: 'SEO',
        brief: 'useSeoMeta / 文件约定 / 结构化数据',
        goal: '为每个路由生成可抓取的标题、描述、分享图与 JSON-LD。',
        demos: [
            { name: '元数据 API', href: '/seo/metadata', desc: '静态与动态 useSeoMeta、canonical、OG', kind: 'live' },
            { name: '结构化数据', href: '/seo/structured', desc: 'JSON-LD 注入与 Article / Breadcrumb 示例', kind: 'live' },
            { name: '文件约定', href: '/seo/files', desc: 'sitemap、robots、manifest 与 llms.txt', kind: 'docs' },
        ],
    },
    {
        key: 'i18n',
        title: '国际化',
        mark: 'I18N',
        brief: '语言协商、消息与 RTL',
        goal: '实现路由级语言策略、消息插值与从右到左布局。',
        demos: [
            { name: '多语言路由', href: '/i18n/locale', desc: '前缀策略、Accept-Language 协商与 hreflang', kind: 'live' },
            { name: 'RTL 布局', href: '/i18n/rtl', desc: 'dir 切换与逻辑属性对照物理属性', kind: 'live' },
        ],
    },
    {
        key: 'pwa',
        title: 'PWA 与离线',
        mark: 'PWA',
        brief: 'Service Worker 缓存与离线兜底',
        goal: '掌握 SW 注册、缓存策略、离线页面与更新提示。',
        demos: [
            { name: 'Service Worker 实验台', href: '/pwa/service-worker', desc: '注册 / 注销 / 清缓存 / 在线状态', kind: 'live' },
            { name: '离线兜底策略', href: '/pwa/offline', desc: '预缓存、网络优先与降级页面', kind: 'docs' },
        ],
    },
    {
        key: 'realtime',
        title: '实时通信',
        mark: 'RT2',
        brief: 'SSE / WebSocket / 轮询边界',
        goal: '根据单向推送或双向交互选择实时方案并处理重连。',
        demos: [
            { name: 'SSE 单向推送', href: '/realtime/sse', desc: 'text/event-stream + 自动重连 + 背压', kind: 'live' },
            { name: 'WebSocket 房间', href: '/realtime/websocket', desc: '独立 WS 进程、房间、心跳与离线补发', kind: 'docs' },
        ],
    },
    {
        key: 'ai',
        title: 'AI 集成',
        mark: 'AI',
        brief: '流式对话、结构化输出与 RAG',
        goal: '在服务端代理模型调用，实现流式响应、结构化兜底与检索评估。',
        demos: [
            { name: '流式对话', href: '/ai/streaming', desc: 'ReadableStream 逐字下发与中断处理', kind: 'live' },
            { name: '结构化输出', href: '/ai/structured', desc: 'JSON Schema 约束、校验与失败重试', kind: 'live' },
            { name: 'RAG 检索评估', href: '/ai/rag', desc: '分块、向量检索、引用溯源与 Recall 评估', kind: 'docs' },
        ],
    },
    {
        key: 'fullstack',
        title: '全栈数据层',
        mark: 'FS',
        brief: 'KV / SQL / 事务 / 企业场景',
        goal: '用 Nitro 存储层完成 CRUD，并理解事务、幂等与 Outbox。',
        demos: [
            { name: 'KV 存储 CRUD', href: '/fullstack/kv-api', desc: 'Nitro storage + REST + 类型契约', kind: 'api' },
            { name: '企业级综合场景', href: '/fullstack/enterprise', desc: '多租户、订单状态机、幂等、审计与 Outbox', kind: 'live' },
            { name: '事务与并发', href: '/fullstack/transactions', desc: '隔离级别、乐观锁、防超卖与 N+1', kind: 'docs' },
        ],
    },
    {
        key: 'testing',
        title: '测试体系',
        mark: 'QA',
        brief: '单元 / 组件 / 集成 / E2E 金字塔',
        goal: '把纯函数、组件交互与接口契约纳入可持续的测试金字塔。',
        demos: [
            { name: '单元测试', href: '/testing/unit', desc: '纯函数与共享工具，Vitest 无运行时依赖', kind: 'docs' },
            { name: '组件与接口测试', href: '/testing/integration', desc: '组件交互、Nitro 接口与快照策略', kind: 'docs' },
            { name: 'E2E 与视觉回归', href: '/testing/e2e', desc: 'Playwright 关键路径与截图基线', kind: 'docs' },
        ],
    },
    {
        key: 'theming',
        title: '主题与设计系统',
        mark: 'TH',
        brief: 'Token、暗色模式与多套配色',
        goal: '用语义 token 统一设计系统，支持暗色与多主题正交组合。',
        demos: [
            { name: '暗色模式', href: '/theming/dark', desc: '无闪烁切换、系统偏好与持久化', kind: 'live' },
            { name: '设计 Token', href: '/theming/tokens', desc: '语义 token、组件 token 与多主题换肤', kind: 'live' },
        ],
    },
    {
        key: 'accessibility',
        title: '无障碍',
        mark: 'A11Y',
        brief: '键盘可达、语义结构与动效偏好',
        goal: '让键盘用户与辅助技术可以完整操作页面。',
        demos: [
            { name: '无障碍实践', href: '/accessibility', desc: 'skip link、landmark、焦点陷阱与 reduced-motion', kind: 'live' },
        ],
    },
    {
        key: 'deployment',
        title: '部署与运维',
        mark: 'OPS',
        brief: '构建产物、发布与回滚',
        goal: '选择托管形态，建立发布、备份与回滚的可重复流程。',
        demos: [
            { name: '部署目标矩阵', href: '/deployment', desc: 'Node / Docker / Serverless / 静态导出对照', kind: 'docs' },
            { name: '发布与回滚', href: '/deployment/runbook', desc: '发布检查单、灰度、备份与回滚步骤', kind: 'docs' },
        ],
    },
];

/** 模块总数 */
export const MODULE_COUNT = MODULES.length;

/** 全部页面（含模块首页与子页） */
export const ALL_PAGES: Array<{ title: string; href: string; module: Module }> = MODULES.flatMap((mod) => [
    { title: mod.title, href: `/${mod.key}`, module: mod },
    ...mod.demos.map((demo) => ({ title: demo.name, href: demo.href, module: mod })),
]);

/** 按 key 查找模块 */
export function findModule(key: string): Module | undefined {
    return MODULES.find((mod) => mod.key === key);
}

/** 按路径查找模块（/routing/dynamic → routing） */
export function moduleByPath(pathname: string): Module | undefined {
    const first = pathname.split('/').filter(Boolean)[0];
    return first ? findModule(first) : undefined;
}

/** 按路径查找标题，用于错误页与兜底 SEO */
export function titleByPath(pathname: string): string | undefined {
    return ALL_PAGES.find((page) => page.href === pathname.replace(/\/$/, ''))?.title;
}

/** 平铺的顺序导航，供上一页 / 下一页使用 */
export const PAGE_SEQUENCE = ALL_PAGES;

/** 页面总数（用于首页统计） */
export const PAGE_COUNT = ALL_PAGES.length;
