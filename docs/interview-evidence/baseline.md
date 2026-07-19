# 冲刺基线与安全边界

记录日期：2026-07-17（Asia/Shanghai）

## 仓库基线

- Git remote：`https://github.com/Destiny-AX/campus-lost-found-ai-matcher.git`
- 最新 `origin/main`：`b39460b434c996b64c39811f9125ad07b43cebeb`
- 冲刺分支：`feat/ai-interview-evidence`
- 独立工作树：`C:\Users\33501\Documents\ai_product_manager\shixun-ai-interview-evidence`
- 已合并优化基线：`feb7927`（从既有已部署优化提交移植到最新 main 后形成）

原仓库当时位于 `codex/merge-portfolio-fixes-20260715`，且存在用户自己的未跟踪/删除内容。本轮使用独立工作树，没有清理、覆盖或提交这些内容。

## Vercel 与生产入口

- Vercel Project：`shiyun-lost-found`
- Project ID：仅在本地 `.vercel/project.json` 管理，不写入公开文档
- 生产域名：`https://shixun.xyz`
- 本轮允许目标：Vercel Preview
- 本轮禁止目标：Production、`shixun.xyz` 域名绑定

## 环境变量名称（仅名称）

已确认生产项目存在：

- `SILICON_FLOW_API_KEY`
- `SUPABASE_KEY`
- `SUPABASE_URL`
- `LOST_FOUND_JWT_SECRET`

代码同时兼容以下规范化名称：

- `LOST_FOUND_SILICON_FLOW_API_KEY`
- `LOST_FOUND_SUPABASE_URL`
- `LOST_FOUND_SUPABASE_SERVICE_ROLE_KEY`

本轮新增的文本调用预算参数只有名称和默认值，均不含密钥：

- `SILICON_FLOW_TEXT_TOTAL_BUDGET_MS`：28000
- `SILICON_FLOW_TEXT_PRIMARY_TIMEOUT_MS`：18000
- `SILICON_FLOW_TEXT_FALLBACK_TIMEOUT_MS`：9000

## Supabase 配置方式

Functions 通过 `api/_shared.js` 在服务端读取 URL 与 Service Role Key，再以 REST/PostgREST 调用表。浏览器端不持有 Service Role Key。没有发现独立 Preview Supabase 配置，因此本轮不把生产变量复制到 Preview，也不向生产库写测试数据。

## 本轮硬边界

- 不合并或直接推送 main。
- 不发布 Production，不更新 `shixun.xyz`。
- 不读取、输出或硬编码 Key、JWT、Cookie、联系方式。
- 未建立隔离 Preview 数据库前，不执行在线双账号写入测试。
