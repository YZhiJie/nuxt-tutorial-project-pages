<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const OUTPUT_CODE = `.output/
├── public/                 静态资源（客户端产物、favicon、robots）
├── server/
│   ├── index.mjs           Node / Docker 入口
│   ├── chunks/             服务端 bundle
│   └── ...
└── nitro.json              运行时元信息

# 本地验证生产产物
node .output/server/index.mjs
# 默认监听 3000；用 PORT 覆盖`;

const DOCKER_CODE = `# 多阶段构建：构建依赖不进入运行镜像
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \\
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", ".output/server/index.mjs"]`;

const ENV_CODE = `// nuxt.config.ts（现状）
runtimeConfig: {
    // 仅服务端可见；生产用 NUXT_API_SECRET 覆盖
    apiSecret: 'dev-secret',
    public: {
        siteName: 'Nuxt 企业工程练功房',
        siteUrl: 'http://localhost:3000',
    },
},

// 服务端读取
const config = useRuntimeConfig(event);
config.apiSecret;        // 不会出现在客户端 bundle
config.public.siteName;  // 会序列化到客户端，禁止放密钥

// 覆盖规则：runtimeConfig 的 key 自动映射为环境变量
// apiSecret        → NUXT_API_SECRET
// public.siteUrl   → NUXT_PUBLIC_SITE_URL`;

const HEALTH_CODE = `// server/api/health.get.ts（示意）
export default defineEventHandler((event) => {
    setResponseHeader(event, 'cache-control', 'no-store');
    return {
        status: 'ok',
        version: process.env.APP_VERSION ?? 'dev',
        uptime: Math.round(process.uptime()),
    };
});

// 探针只验证「进程能响应」，不要把数据库慢查询放进 liveness
// readiness 才检查依赖；liveness 失败会触发重启，必须足够轻`;

const matrix = [
    { form: 'Node 服务', build: 'nuxt build', fit: '自建 VM / 容器编排', pros: '完整 Nitro 能力、长连接、后台任务', limit: '需要进程管理与滚动发布' },
    { form: 'Docker', build: 'nuxt build + 镜像', fit: 'K8s / ECS / 云容器', pros: '环境一致、可复现、易回滚', limit: '镜像体积与构建缓存要治理' },
    { form: 'Serverless', build: 'nuxt build（目标 preset）', fit: '流量波动大、运维资源少', pros: '免运维、按需伸缩', limit: '无持久本地盘、冷启动、后台任务受限' },
    { form: '静态导出', build: 'nuxt generate', fit: '纯内容站 / 文档站', pros: 'CDN 成本低、无服务端攻击面', limit: '没有 /api 与动态会话' },
];

const pipeline = [
    '构建前：类型检查与测试必须全绿，禁止“先发再修”。',
    '构建产物只来自 CI，不在服务器上执行 npm install。',
    '镜像 / 产物带版本号与 git sha，回滚时能精确定位。',
    '发布前用生产等同的环境变量跑一次冒烟。',
    '健康检查分 liveness 与 readiness，阈值与超时写进编排配置。',
    '日志与指标在发布前就位，否则出问题只能靠猜。',
];
</script>

<template>
    <DocPage
        title="部署目标矩阵"
        description="部署形态决定能力边界：Node 与 Docker 保留完整 Nitro，Serverless 换弹性但牺牲持久状态，静态导出只适合纯内容。先选形态，再谈流水线。"
        :tags="['.output', 'Docker', 'Serverless', '静态导出', '健康检查']"
    >
        <DocSection id="matrix" title="四种托管形态" kicker="01 · MATRIX">
            <p class="body-text">
                选择部署形态的本质是回答三个问题：是否需要动态接口、是否需要持久状态、
                是否愿意承担运维。本项目的 <code>/api/*</code> 与 KV 存储意味着
                静态导出不适用，Serverless 需要把 fs 驱动换掉。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>形态</th><th>构建命令</th><th>适合</th><th>优点</th><th>限制</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in matrix" :key="row.form">
                            <td>{{ row.form }}</td>
                            <td class="mono">{{ row.build }}</td>
                            <td>{{ row.fit }}</td>
                            <td>{{ row.pros }}</td>
                            <td>{{ row.limit }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <Callout type="warn" title="Serverless 上的 fs 存储">
                <code>nuxt.config.ts</code> 里的 <code>data</code> 命名空间使用 fs 驱动，
                写到本地 <code>.data/kv</code>。Serverless 实例的本地盘不持久且不共享，
                上线前必须换成 Redis / S3 等外部存储。
            </Callout>
        </DocSection>

        <DocSection id="output" title="构建产物 .output" kicker="02 · OUTPUT">
            <p class="body-text">
                <code>nuxt build</code> 产出的是自包含的 <code>.output/</code>：
                <code>public/</code> 是静态资源，<code>server/index.mjs</code> 是可执行入口。
                部署时只复制这个目录，不再执行安装与构建。
            </p>
            <CodeBlock :code="OUTPUT_CODE" lang="text" title=".output 结构" />
            <CodeBlock :code="DOCKER_CODE" lang="dockerfile" title="多阶段 Dockerfile" />
        </DocSection>

        <DocSection id="env" title="环境变量与 runtimeConfig" kicker="03 · ENV">
            <p class="body-text">
                <code>runtimeConfig</code> 区分服务端私有与客户端公开：
                密钥放顶层，可展示配置放 <code>public</code>。
                key 会自动映射为 <code>NUXT_</code> 前缀的大写下划线环境变量。
            </p>
            <CodeBlock :code="ENV_CODE" lang="ts" title="runtimeConfig 与覆盖规则" />
            <Callout type="danger" title="public 不是保险箱">
                任何写进 <code>public</code> 的值都会出现在客户端 bundle。
                密钥、数据库连接串、内部服务地址一律放服务端私有字段。
            </Callout>
        </DocSection>

        <DocSection id="health" title="健康检查与探针" kicker="04 · HEALTH">
            <p class="body-text">
                健康检查不是“接口能返回 200”这么简单：liveness 判断进程是否卡死，
                失败会被重启；readiness 判断依赖是否就绪，失败只会被摘流量。
                两者混用会把数据库抖动放大成滚动重启。
            </p>
            <CodeBlock :code="HEALTH_CODE" lang="ts" title="健康检查接口与探针" />
            <ul class="checklist">
                <li v-for="item in pipeline" :key="item">{{ item }}</li>
            </ul>
        </DocSection>

        <DocSection id="next" title="继续" kicker="05 · NEXT">
            <NuxtLink to="/deployment/runbook" class="next-link">
                阅读「发布与回滚」：检查单、灰度、迁移备份与事故复盘 →
            </NuxtLink>
        </DocSection>
    </DocPage>
</template>

<style scoped>
.body-text {
    margin: 0 0 12px;
    font-size: 14px;
    line-height: 1.8;
    color: var(--text-muted);
}

.checklist {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 14px 0 0;
    padding: 0;
    list-style: none;
}

.checklist li {
    position: relative;
    padding-left: 26px;
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.7;
}

.checklist li::before {
    content: '✓';
    position: absolute;
    left: 0;
    top: 0;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 11px;
}

.next-link {
    display: inline-flex;
    padding: 12px 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--accent);
    font-size: 14px;
    transition: border-color 150ms ease;
}

.next-link:hover {
    border-color: var(--accent);
}
</style>
