<script setup lang="ts">
definePageMeta({ layout: 'docs' });

interface RateLimitResponse {
    allowed: boolean;
    limit: number;
    used: number;
    remaining: number;
    windowMs: number;
    resetAt: number;
    retryAfter: number;
}

interface LogEntry {
    id: number;
    status: number;
    message: string;
    at: string;
}

const result = ref<RateLimitResponse | null>(null);
const logs = ref<LogEntry[]>([]);
const busy = ref(false);
let logSeq = 0;

function pushLog(status: number, message: string) {
    logs.value = [
        {
            id: logSeq++,
            status,
            message,
            at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        },
        ...logs.value,
    ].slice(0, 8);
}

async function hit() {
    if (busy.value) return;
    busy.value = true;
    try {
        const data = await $fetch<RateLimitResponse>('/api/security/rate-limit');
        result.value = data;
        pushLog(200, `通过：剩余 ${data.remaining} 次`);
    } catch (error) {
        const payload = (
            error as {
                statusCode?: number;
                data?: {
                    statusCode?: number;
                    message?: string;
                    data?: { retryAfter?: number; limit?: number };
                };
            }
        );
        const status = payload.statusCode ?? payload.data?.statusCode ?? 429;
        const retryAfter = payload.data?.data?.retryAfter ?? 0;
        const limit = payload.data?.data?.limit ?? 5;

        result.value = {
            allowed: false,
            limit,
            used: limit,
            remaining: 0,
            windowMs: 10_000,
            resetAt: Date.now() + retryAfter * 1000,
            retryAfter,
        };
        pushLog(status, getApiErrorMessage(error, '请求被拒绝'));
    } finally {
        busy.value = false;
    }
}

function resetLocal() {
    result.value = null;
    logs.value = [];
}

const SERVER_CODE = `// server/api/security/rate-limit.get.ts
interface WindowEntry { count: number; resetAt: number }

const LIMIT = 5;
const WINDOW_MS = 10_000;

// 进程内固定窗口：单实例可用，多实例需换 Redis
const buckets = new Map<string, WindowEntry>();

export default defineEventHandler((event) => {
    setResponseHeader(event, 'Cache-Control', 'no-store');

    const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
    const now = Date.now();

    let entry = buckets.get(ip);
    if (!entry || now >= entry.resetAt) {
        entry = { count: 0, resetAt: now + WINDOW_MS };
        buckets.set(ip, entry);
    }

    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

    if (entry.count >= LIMIT) {
        setResponseHeader(event, 'Retry-After', retryAfter);
        throw createError({
            statusCode: 429,
            message: '请求过于频繁，请稍后再试',
            data: { limit: LIMIT, remaining: 0, retryAfter },
        });
    }

    entry.count += 1;
    return {
        allowed: true,
        limit: LIMIT,
        used: entry.count,
        remaining: LIMIT - entry.count,
        windowMs: WINDOW_MS,
        resetAt: entry.resetAt,
        retryAfter,
    };
});`;

const ALGO_CODE = `// 固定窗口：实现最简单，但窗口边界会出现 2 倍突发
// 00:00–00:10 的第 5 次 + 00:10–00:20 的前 5 次
// 两秒内实际放行 10 次

// 生产可选：
// - 滑动窗口日志：精确，但存储成本高
// - 滑动窗口计数：折中方案
// - 令牌桶：允许短时突发，长期速率受限
// - 漏桶：严格匀速，适合保护下游

// 计数必须原子：Redis INCR + EXPIRE
// const key = 'rate:' + ip;
// const used = await redis.incr(key);
// if (used === 1) await redis.expire(key, 10);`;

const CLIENT_CODE = `try {
    const data = await $fetch('/api/security/rate-limit');
    remaining.value = data.remaining;
} catch (error) {
    // 429 时读取 Retry-After（或响应体里的 retryAfter）
    const retryAfter = error.data?.data?.retryAfter ?? 1;
    countdown.value = retryAfter;
    message.value = '请求过于频繁，请 ' + retryAfter + ' 秒后重试';
}`;

const algorithms = [
    { name: '固定窗口', pros: '实现简单、内存小', cons: '窗口边界可能双倍突发', fit: '内部低风险接口、演示' },
    { name: '滑动窗口', pros: '边界平滑、更精确', cons: '需要更多存储或近似结构', fit: '登录、短信、支付' },
    { name: '令牌桶', pros: '允许短时突发', cons: '参数调优成本', fit: '开放 API 配额' },
    { name: '漏桶', pros: '输出严格匀速', cons: '突发请求会被排队或丢弃', fit: '保护脆弱下游' },
];

const notes = [
    '内存 Map 只在单实例内有效；多副本部署时每个实例都有独立计数，必须换 Redis 等共享存储。',
    '限流键不能只用 IP：登录接口应叠加账号维度，避免共享出口 IP 误伤，也防止攻击者轮换 IP。',
    '代理后部署要正确配置可信代理，否则 getRequestIP 拿到的全是同一个内网地址。',
    '限流返回 429 并带 Retry-After；不要返回 500，客户端才能正确退避。',
    '限流只是成本与滥用控制，不能替代认证、授权与输入校验。',
];
</script>

<template>
    <DocPage
        title="接口限流"
        description="限流是运行期的资源保护：限制单位时间内的请求次数，让暴力破解、爬取与误用无法拖垮服务。本页接口用内存固定窗口实现 5 次 / 10 秒。"
        :tags="['固定窗口', '429', 'Retry-After', '限流算法']"
    >
        <DocSection id="why" title="限流保护什么" kicker="01 · WHY">
            <p class="body-text">
                限流不是“防止用户点太快”，而是保护稀缺资源：数据库连接、
                第三方配额、CPU、短信与邮件成本。登录接口不限流，攻击者可以低成本撞库；
                搜索接口不限流，一个脚本就能把数据库打满。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>接口</th><th>建议维度</th><th>典型阈值</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>登录</td><td>IP + 账号</td><td>5 次 / 分钟，失败递增</td></tr>
                        <tr><td>注册 / 短信</td><td>IP + 手机号</td><td>1 次 / 分钟，5 次 / 天</td></tr>
                        <tr><td>搜索</td><td>IP + 用户</td><td>20 次 / 分钟</td></tr>
                        <tr><td>写操作</td><td>用户</td><td>60 次 / 分钟</td></tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="algo" title="固定窗口实现" kicker="02 · ALGORITHM">
            <p class="body-text">
                固定窗口把时间切成等长区间，每个区间独立计数。
                实现只需要一个 <code>Map&lt;key, { count, resetAt }&gt;</code>：
                过期就重置，计数到上限就拒绝，否则自增并返回剩余次数。
            </p>
            <CodeBlock :code="SERVER_CODE" lang="ts" title="server/api/security/rate-limit.get.ts" />
            <CodeBlock :code="ALGO_CODE" lang="ts" title="算法取舍与原子计数" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>算法</th><th>优点</th><th>缺点</th><th>适用</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in algorithms" :key="item.name">
                            <td>{{ item.name }}</td>
                            <td>{{ item.pros }}</td>
                            <td>{{ item.cons }}</td>
                            <td>{{ item.fit }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="protocol" title="429 与 Retry-After" kicker="03 · PROTOCOL">
            <p class="body-text">
                超限时返回 <code>429 Too Many Requests</code>，并通过
                <code>Retry-After</code> 告诉客户端多少秒后可以重试。
                客户端应据此退避，而不是立刻重试或无限轮询。
            </p>
            <CodeBlock :code="CLIENT_CODE" lang="ts" title="客户端处理 429" />
            <Callout type="warn" title="限流要可观测">
                记录被限流的 key、路径与命中次数。持续命中往往意味着攻击、
                爬虫或前端 bug（例如轮询没有退避），而不是普通用户太活跃。
            </Callout>
        </DocSection>

        <DocSection id="demo" title="连续点击触发 429" kicker="04 · DEMO">
            <p class="body-text">
                每个 IP 在 10 秒窗口内允许 5 次。连续点击第六次即可看到
                <code>429</code>，并显示剩余次数与重试等待时间。
                窗口按服务器时间滚动，等待结束后计数自动重置。
            </p>
            <DemoCard
                title="固定窗口限流器"
                desc="点击请求 /api/security/rate-limit；前 5 次通过，第 6 次返回 429。"
                badge="LIVE"
            >
                <div class="demo-row">
                    <button class="btn" type="button" :disabled="busy" @click="hit">
                        {{ busy ? '请求中……' : '发起一次请求' }}
                    </button>
                    <button class="btn btn--ghost btn--sm" type="button" @click="resetLocal">
                        清空本地记录
                    </button>
                </div>

                <div v-if="result" class="result" :class="result.allowed ? 'result--ok' : 'result--blocked'">
                    <div class="result-head">
                        <span class="badge" :class="result.allowed ? 'badge--accent' : 'badge--danger'">
                            {{ result.allowed ? '200 通过' : '429 已限流' }}
                        </span>
                        <span class="muted mono">窗口 10s</span>
                    </div>
                    <div class="quota-row">
                        <span class="quota-label">剩余次数</span>
                        <div class="quota-dots">
                            <span
                                v-for="index in result.limit"
                                :key="index"
                                class="dot"
                                :class="{ 'dot--used': index <= result.used }"
                            />
                        </div>
                        <span class="quota-value mono">{{ result.remaining }} / {{ result.limit }}</span>
                    </div>
                    <p v-if="result.allowed" class="result-note">
                        本窗口已用 {{ result.used }} 次，再请求 {{ result.remaining }} 次后将返回 429。
                    </p>
                    <p v-else class="result-note">
                        请等待 {{ result.retryAfter }} 秒后重试（响应头 Retry-After）。
                    </p>
                </div>
                <p v-else class="empty">尚未发起请求。</p>

                <div v-if="logs.length" class="log-list">
                    <div v-for="entry in logs" :key="entry.id" class="log-row">
                        <span class="mono log-time">{{ entry.at }}</span>
                        <span class="badge" :class="entry.status === 200 ? 'badge--accent' : 'badge--danger'">
                            {{ entry.status }}
                        </span>
                        <span class="log-msg">{{ entry.message }}</span>
                    </div>
                </div>

                <template #footer>
                    限流按 IP 在服务端进程内计数；刷新页面不会重置，等待窗口结束后自动恢复。
                </template>
            </DemoCard>
        </DocSection>

        <DocSection id="production" title="生产注意事项" kicker="05 · PRODUCTION">
            <ul class="checklist">
                <li v-for="item in notes" :key="item">{{ item }}</li>
            </ul>
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

.demo-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.result {
    margin-top: 14px;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
}

.result--ok {
    border-color: var(--success-border);
}

.result--blocked {
    border-color: rgba(248, 113, 113, 0.45);
}

.result-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
    font-size: 11px;
}

.quota-row {
    display: flex;
    align-items: center;
    gap: 10px;
}

.quota-label {
    font-size: 12px;
    color: var(--text-muted);
}

.quota-dots {
    display: flex;
    gap: 5px;
}

.dot {
    width: 12px;
    height: 12px;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    background: transparent;
}

.dot--used {
    border-color: var(--accent);
    background: var(--accent-soft);
}

.quota-value {
    margin-left: auto;
    font-size: 12px;
    color: var(--text);
}

.result-note {
    margin: 10px 0 0;
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-muted);
}

.empty {
    margin: 14px 0 0;
    font-size: 12px;
    color: var(--text-faint);
}

.log-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
}

.log-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
}

.log-time {
    color: var(--text-faint);
    font-size: 11px;
}

.log-msg {
    color: var(--text-muted);
}

.checklist {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
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
    content: '!';
    position: absolute;
    left: 0;
    top: 0;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: rgba(251, 191, 36, 0.15);
    color: var(--warn);
    font-family: var(--font-mono);
    font-size: 11px;
}
</style>
