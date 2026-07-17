# 本地 QA 结果

执行日期：2026-07-17。

| 命令 | 结果 |
|---|---|
| `npm install` | 成功；up to date；审计 1 个包；0 vulnerabilities |
| `npm run check` | 通过；19 个必需文件、38 个 JavaScript 文件；未发现常见硬编码密钥 |
| `npm run test:heuristic` | 21/21 通过 |
| `npm run test:smoke` | 24/24 通过；首页、中文静态路径、API、隐私、七维匹配、端口清理均通过 |
| `npm run test:evaluation` | 28 查询、18 候选、3 配置、3 消融；成功生成结果 |
| `npm run test:observability` | 8/8 通过 |
| `npm run test:claim-flow` | 17/17 通过；cleanup_remaining=0；production_writes=0 |

## 兼容性确认

- 在线视觉模型入口与 SiliconFlow 配置代码保留。
- Supabase 服务端 REST/PostgREST 接入保留。
- 七维匹配及缺失维度动态重分配保留。
- 游客脱敏、审核后解锁、双用户权限隔离与归还确认保留。
- Smoke Test 使用独立随机端口并在结束后释放，没有遗留服务。

## 线上限制

Preview 环境变量列表为空。本轮不复制 Production Key 到 Preview，因此 Preview 会展示无 Key 的规则/本地算法降级，这符合安全边界但无法用于真实模型或 Preview Supabase 写入闭环。生产域名和 Production 部署未修改。

