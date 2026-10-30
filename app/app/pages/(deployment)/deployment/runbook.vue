<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const PRECHECK_CODE = `# 发布前：在 CI 或本地按顺序执行，任何一步失败即停止
npm run typecheck
npm run test
npm run build

# 用生产等价的环境变量做一次冒烟
PORT=3100 node .output/server/index.mjs &
curl -fsS http://127.0.0.1:3100/api/health
curl -fsS http://127.0.0.1:3100/api/fullstack/items > /dev/null
kill %1

# 打版本标签，回滚时按标签定位
git tag -a v2026.10.30 -m "release 2026-10-30"
git push origin v2026.10.30`;

const GRAY_CODE = `发布节奏（示例）
阶段    流量比例    观察窗口    通过条件
1       1%          30 分钟     5xx < 0.1%，p95 < 500ms
2       10%         1 小时      与阶段 1 相同 + 业务错误率不升高
3       50%         2 小时      核心路径 E2E 通过，无新增告警
4       100%        —           观察 24 小时后再删除旧版本

# 任何阶段命中回滚条件：立即停止放量，按「回滚步骤」执行`;

const MIGRATION_CODE = `-- Expand / Contract：先兼容，再切换，最后清理
-- 1. 扩展：新增可空列（旧代码不受影响）
ALTER TABLE orders ADD COLUMN status_v2 text NULL;

-- 2. 双写：新版本同时写 status 与 status_v2，灰度期间保持兼容
-- 3. 回填：后台分批把历史数据写入 status_v2，避免长事务锁表
UPDATE orders SET status_v2 = status WHERE status_v2 IS NULL;

-- 4. 切换读：确认新旧一致后再收紧约束
ALTER TABLE orders ALTER COLUMN status_v2 SET NOT NULL;

-- 5. 收缩：下个版本删除旧列（必须晚于回滚窗口）
-- ALTER TABLE orders DROP COLUMN status;`;

const BACKUP_CODE = `# 发布前备份，文件名带时间戳，便于定位
pg_dump --format=custom \\
  --file=backup-$(date +%Y%m%d-%H%M).dump \\
  "$DATABASE_URL"

# 备份必须可恢复：定期在隔离库做恢复演练
pg_restore --clean --if-exists \\
  --dbname=restore_check \\
  backup-20261030-1400.dump

# 从未恢复过的备份，等于没有备份`;

const ROLLBACK_CODE = `# 1. 切回上一个版本（镜像 tag / 部署记录 / 上一个 release 目录）
kubectl rollout undo deployment/nuxt-app
# 或：docker compose up -d --image nuxt-app:v2026.10.29

# 2. 数据库回滚要谨慎：若已执行不可逆迁移，优先前滚修复
#    可逆迁移执行 down 脚本前，确认旧代码能读取新结构

# 3. 验证
curl -fsS https://example.com/api/health
# 再跑核心路径：首页、登录、文档页、订单创建

# 4. 记录：回滚时间、版本、触发指标、影响面`;

const POSTMORTEM_CODE = `# 事故复盘：<标题>

## 摘要
- 影响时间：2026-10-30 14:05 → 14:32（UTC+8）
- 影响面：约 3% 的订单创建请求返回 500
- 严重级别：P2
- 错误预算消耗：12%

## 时间线
| 时间 | 事件 |
| --- | --- |
| 14:05 | 告警：/api/fullstack/orders 5xx 突增 |
| 14:08 | 值班确认，停止灰度放量 |
| 14:12 | 定位到新增的幂等键缓存未设置上限 |
| 14:20 | 回滚到上一版本，错误率恢复 |
| 14:32 | 核心路径验证通过，解除告警 |

## 根因
幂等键 Map 无上限增长，内存耗尽导致进程重启。

## 改进项
| 动作 | 负责人 | 截止 | 状态 |
| --- | --- | --- | --- |
| 幂等键改为 Redis + TTL | 后端 | 11-05 | 待办 |
| 增加内存与重启次数告警 | SRE | 11-02 | 待办 |
| 灰度阶段增加长稳压测 | QA | 11-10 | 待办 |

## 经验
- 做对了：灰度只放到 1%，影响面被限制。
- 要改进：回滚决策晚了 7 分钟，缺少明确的触发阈值。`;

const stages = [
    { stage: '1%', window: '30 分钟', gate: '5xx < 0.1%，p95 < 500ms' },
    { stage: '10%', window: '1 小时', gate: '错误率不升高，无新增告警' },
    { stage: '50%', window: '2 小时', gate: '核心路径 E2E 通过' },
    { stage: '100%', window: '24 小时', gate: '稳定后才删除旧版本' },
];

const decisions = [
    { signal: '5xx 持续升高', action: '立即停止放量，评估回滚' },
    { signal: 'p95 超过阈值但错误率正常', action: '回退到上一阶段，排查慢查询' },
    { signal: '单个非核心功能异常', action: '关闭功能开关，保留发布' },
    { signal: '数据库结构不兼容', action: '优先前滚修复，不贸然 down' },
];

const precheck = [
    '类型检查、单元测试、构建全部通过，且是在待发布 commit 上执行。',
    '数据库迁移已评审：是否可逆、是否锁表、回滚窗口多长。',
    '备份已完成并验证可恢复，备份文件不在应用服务器本地。',
    '环境变量与密钥已在目标环境配置，未写进仓库。',
    '健康检查、日志、指标、告警在发布前已就位。',
    '回滚方案与负责人明确，发布时间避开业务高峰。',
];
</script>

<template>
    <DocPage
        title="发布与回滚"
        description="发布是可控实验，不是赌博。检查单降低低级错误，灰度限制影响面，备份与回滚保证可逆，复盘把事故变成系统改进。"
        :tags="['发布检查单', '灰度', '数据库迁移', '备份', '事故复盘']"
    >
        <DocSection id="precheck" title="发布前检查单" kicker="01 · PRE-CHECK">
            <p class="body-text">
                检查单要能被执行，而不是被勾选。每一条都对应一个命令或一个可验证的事实：
                构建来自待发布的 commit、备份可恢复、回滚有人负责。
            </p>
            <ul class="checklist">
                <li v-for="item in precheck" :key="item">{{ item }}</li>
            </ul>
            <CodeBlock :code="PRECHECK_CODE" lang="bash" title="发布前命令序列" />
        </DocSection>

        <DocSection id="gray" title="灰度发布" kicker="02 · CANARY">
            <p class="body-text">
                灰度把一次大爆炸拆成多次小实验。每个阶段都有明确的观察窗口与通过条件，
                不满足就停在当前比例，而不是“再等等看”。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>阶段</th><th>观察窗口</th><th>通过条件</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in stages" :key="row.stage">
                            <td class="mono">{{ row.stage }}</td>
                            <td>{{ row.window }}</td>
                            <td>{{ row.gate }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="GRAY_CODE" lang="text" title="放量节奏" />
        </DocSection>

        <DocSection id="migration" title="数据库迁移与备份" kicker="03 · MIGRATION">
            <p class="body-text">
                应用可以随时回滚，数据库不一定。迁移必须遵循 Expand / Contract：
                先加兼容结构，双写并回填，切换读，最后在下一个版本删除旧结构。
                这样旧代码与新代码都能在过渡期运行。
            </p>
            <CodeBlock :code="MIGRATION_CODE" lang="sql" title="Expand / Contract" />
            <CodeBlock :code="BACKUP_CODE" lang="bash" title="备份与恢复演练" />
            <Callout type="danger" title="不可逆迁移">
                删除列、改类型、清空数据这类操作一旦执行，回滚就只能靠备份。
                把它们安排在与代码发布分离的独立窗口，并确认备份已恢复验证。
            </Callout>
        </DocSection>

        <DocSection id="rollback" title="回滚步骤" kicker="04 · ROLLBACK">
            <p class="body-text">
                回滚不是“重新部署一次”，而是有顺序的恢复：
                先止血（切回旧版本）、再验证、最后记录。
                数据库已变更时，前滚修复通常比强行 down 更安全。
            </p>
            <CodeBlock :code="ROLLBACK_CODE" lang="bash" title="回滚命令" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>信号</th><th>建议动作</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in decisions" :key="row.signal">
                            <td>{{ row.signal }}</td>
                            <td>{{ row.action }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="postmortem" title="事故复盘模板" kicker="05 · POSTMORTEM">
            <p class="body-text">
                复盘的目标是改进系统，不是追责个人。时间线用事实而非印象；
                改进项必须有负责人、截止时间与验收方式，并在下一次复盘中回顾。
            </p>
            <CodeBlock :code="POSTMORTEM_CODE" lang="markdown" title="复盘模板" />
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
    margin: 0 0 14px;
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
</style>
