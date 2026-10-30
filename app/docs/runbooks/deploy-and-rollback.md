# 发布与回滚手册

适用范围：本知识站及同构的 Nuxt 4 SSR 应用。

## 1. 发布前检查单

- [ ] `pnpm typecheck` 通过，无新增类型错误。
- [ ] `pnpm test` 通过，关键纯函数与工具覆盖。
- [ ] `pnpm build` 成功，`.output/server/index.mjs` 存在。
- [ ] 环境变量齐全：`NUXT_API_SECRET`、站点 URL、第三方密钥；密钥不得进入构建产物。
- [ ] `routeRules` 变更已评审：`prerender` / `swr` / `ssr` 影响面明确。
- [ ] 新增接口已完成鉴权、限流与错误码检查。
- [ ] 数据库 / KV 变更具备向前兼容与回滚脚本。
- [ ] 监控面板已包含错误率、P95、5xx 与关键接口可用性。

## 2. 发布流程

1. 合并到 `main`，CI 产出构建产物与测试报告。
2. 部署到预发环境，执行冒烟：
   - 首页、任一模块页、登录、一个受保护接口。
   - `/api/observability/metrics` 可抓取。
   - `/security/headers` 返回预期响应头。
3. 灰度 10% 流量，观察 15 分钟：错误率、P95、SSE 连接数、缓存命中率。
4. 逐步放量至 50% → 100%，每阶段保留回滚窗口。
5. 发布完成后记录版本号、变更摘要与负责人。

## 3. 回滚步骤

触发条件：5xx 连续 5 分钟超过 1%、P95 翻倍、关键路径不可用、数据写入异常。

1. 立即停止继续放量，切回上一版本镜像 / 构建产物。
2. 若涉及数据结构变更，先确认向后兼容；必要时执行回滚脚本。
3. 清理 CDN / Nitro 缓存，避免旧 HTML 与新资源错配。
4. 验证核心路径后恢复流量。
5. 24 小时内输出事故复盘：时间线、影响面、根因、改进项与负责人。

## 4. 常用命令

```bash
pnpm build
node .output/server/index.mjs

# 冒烟
curl -sS http://localhost:3000/api/hello
curl -sSI http://localhost:3000/security/headers | grep -Ei 'x-frame|x-content|referrer|permissions'
curl -sS http://localhost:3000/api/observability/metrics | head
```

## 5. 备份与恢复

- KV / 数据库每日全量备份，保留 7 天；发布前额外做一次快照。
- 备份恢复需在预发演练，记录 RTO / RPO 实测值。
- 静态资源带内容指纹，回滚时无需清理旧文件；HTML 缓存必须清理。
