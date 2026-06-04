# 拾寻 v2 — 城市拾遗网络 交接文档

## 1. 项目概况

- 项目名称：拾寻 · 城市拾遗网络（从"校园失物招领"升级）
- 项目类型：响应式 H5 / Vercel Serverless / Supabase / AI 语义识别 + 结构化提取
- 工作目录：`d:\Trae_Solo_Project\拾寻`
- 原始源码：`C:\Users\33501\OneDrive\文档\New project`（v1 版本）
- 线上地址：`https://campus-lost-found-ai-matcher.vercel.app`
- GitHub 仓库：`https://github.com/Destiny-AX/campus-lost-found-ai-matcher`
- 当前用途：课堂 demo 优先，架构预留城市级扩展空间

## 2. v1 → v2 核心变更

| 维度 | v1（校园版） | v2（城市级） |
|------|-------------|-------------|
| 场景 | 校园 | 城市级泛公共物联网络 |
| 隐私 | 全量公开 | 三层模糊化 + 实名解锁 |
| 账号 | 无（localStorage 标记） | Mock 微信登录 + JWT + Supabase Auth |
| 输入 | 手动填 6+ 字段 | AI 自然语言结构化 + 手动确认 |
| 物品状态 | 仅 lost/found | 4 种状态（原地/保管/被捡/机构）+ 流程分流 |
| 通知 | 无 | 站内实时通知（8s 轮询） |
| 代保管 | 无 | 完整寄存→取件码→取件流程 |
| 公共机构 | 无 | Mock 机构账号 + 官方认证标签 |
| 信用 | 无 | 积分 + 徽章系统 |
| 移动端 | 基本适配 | 底部 Tab 导航 + 卡片流 + 触摸优化 |
| 删除权限 | 任意 ID 可删 | JWT 校验 + owner_id 鉴权 |

## 3. 技术栈

- 前端：原生 HTML / CSS / JavaScript（单页 SPA）
- 后端：Vercel Serverless Functions（7 个 API 端点）
- 数据库：Supabase Postgres（5 张表 + RLS）
- AI：SiliconFlow（视觉模型 Qwen3-VL-8B + 文本模型 Qwen3-8B）
- 鉴权：自建 HS256 JWT（Supabase Key 派生签名密钥）
- 本地运行：`node local-server.js`，端口 `4173`

## 4. 文件清单

```
├── index.html              页面结构（6 个视图 + 4 个弹窗 + 底部 Tab）
├── style.css               Apple 风格 UI + 三断点响应式 + 移动端 Tab
├── script.js               前端全部业务逻辑（~1146 行）
├── local-server.js         本地开发服务器（路由到 7 个 API）
├── vercel.json             Vercel 部署配置（9 个 builds）
├── supabase-schema.sql     数据库 DDL（5 张表 + 种子数据）
├── package.json            项目元信息
├── api/
│   ├── _shared.js          共享工具（JWT/Supabase/环境变量/取件码）
│   ├── auth.js             账号鉴权（微信登录/游客/实名认证）
│   ├── records.js          记录 CRUD（含模糊化 + owner 校验）
│   ├── analyze-image.js    视觉语义识别（沿用 v1）
│   ├── structured-input.js AI 自然语言结构化提取
│   ├── notify.js           站内通知（短轮询/已读/推送）
│   └── custody.js          代保管点 + 公共机构 + 寄存/取件
└── 校园失物招领AI项目交接文档.md  v1 交接文档（归档）
```

## 5. 环境变量

优先级从高到低：

| 变量 | 用途 |
|------|------|
| `LOST_FOUND_SUPABASE_URL` | Supabase 项目 URL |
| `LOST_FOUND_SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务端密钥 |
| `LOST_FOUND_SILICON_FLOW_API_KEY` | SiliconFlow API Key |
| `LOST_FOUND_JWT_SECRET` | JWT 签名密钥（未设则从 Supabase Key 派生） |

兼容旧变量：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`SILICON_FLOW_API_KEY` 等。

⚠️ 密钥不得写入代码、文档或 Git。

## 6. 数据库 Schema（v2 新增）

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `lost_found_records` | 失物招领记录 | +owner_id, item_status, custody_point_id, pickup_code |
| `shiyun_users` | 用户账号 | id, nickname, wechat_openid, is_verified, credit_score, badges |
| `shiyun_custody_points` | 代保管点 | id, name, address, lat/lng, type |
| `shiyun_notifications` | 站内通知 | id, user_id, type, title, is_read |
| `shiyun_credit_logs` | 信用变更日志 | id, user_id, action, delta |

`lost_found_records` 通过 `ALTER TABLE ADD COLUMN IF NOT EXISTS` 增量扩展，兼容 v1 数据。

## 7. API 端点

| 方法 | 路径 | 功能 | 鉴权 |
|------|------|------|------|
| GET | `/api/records` | 列表（自动模糊化） | 可选（影响模糊化程度） |
| POST | `/api/records` | 创建记录 | 可选（填充 owner_id） |
| DELETE | `/api/records` | 删除记录 | 必须（校验 owner） |
| PATCH | `/api/records` | 更新状态 | 必须 |
| POST | `/api/auth?action=wechat-login` | Mock 微信登录 | 无 |
| POST | `/api/auth?action=guest-login` | 游客登录 | 无 |
| POST | `/api/auth?action=verify-identity` | 实名认证 | 必须 |
| GET | `/api/auth?action=me` | 当前用户信息 | 必须 |
| POST | `/api/structured-input` | AI 结构化提取 | 无 |
| GET | `/api/notify?action=poll` | 轮询通知 | 可选 |
| POST | `/api/notify?action=mark-read` | 标记已读 | 必须 |
| POST | `/api/notify?action=push` | 推送通知 | 无 |
| POST | `/api/custody?action=deposit` | 寄存物品 | 必须 |
| POST | `/api/custody?action=pickup` | 取件 | 必须 |
| GET | `/api/custody?action=points` | 代保管点列表 | 无 |
| GET | `/api/custody?action=institutions` | 机构列表 | 无 |
| POST | `/api/analyze-image` | 视觉语义识别 | 无 |

## 8. 模糊化规则

| 字段 | 模糊化策略 | 解锁条件 |
|------|-----------|---------|
| 位置 | "XX路附近 500m" / "XX区范围内" | 实名认证用户 |
| 时间 | "今天下午" / "昨天上午" / "3天前晚上" | 实名认证用户 |
| 联系方式 | "实名认证后查看" | 实名认证用户 |
| 描述 | 保留前 20 字 + "..." | 实名认证用户 |
| 图片 | CSS blur(8px) | 实名认证用户 |

模糊化在后端 `records.js` 的 `fromSupabaseRow` 中执行，前端根据 `is_fuzzy` 标记展示。

## 9. 匹配算法（沿用 v1，权重不变）

7 维加权：类别 13% / 颜色 8% / 地点 14% / 时间 11% / 文本 14% / 图像 20% / 语义 20%

地点邻接图已扩展为城市级（南京东路/人民广场/静安寺/徐家汇/陆家嘴等 11 个节点）。

## 10. Demo 阶段 Mock 说明

| 功能 | Mock 方式 | 生产替换点 |
|------|----------|-----------|
| 微信登录 | 前端弹窗输入昵称 → 后端生成假 openid | `api/auth.js` 的 `handleWechatLogin`，替换为微信 OAuth code 换 token |
| 实名认证 | 姓名≥2字 + 身份证末4位为数字 | `api/auth.js` 的 `handleVerifyIdentity`，接入阿里云/腾讯云实人认证 API |
| 代保管点 | 预置 5 条种子数据 | `api/custody.js` 的 `SEED_POINTS`，替换为真实商户/快递柜 API |
| 公共机构 | 预置 4 条种子数据 | `api/custody.js` 的 `SEED_INSTITUTIONS`，对接地铁/派出所 API |
| 通知推送 | 内存数组 + 短轮询 | `api/notify.js`，替换为 SSE Edge Function 或 Web Push |
| 信用积分 | 前端硬编码初始值 5 | `api/auth.js`，接入 `shiyun_credit_logs` 表计算 |

## 11. 常用命令

```powershell
# 本地运行
node local-server.js

# 语法检查
node --check script.js
node --check api/_shared.js
node --check api/auth.js
node --check api/structured-input.js
node --check api/notify.js
node --check api/custody.js
node --check api/records.js
node --check api/analyze-image.js
node --check local-server.js

# 部署
npx vercel deploy --prod --yes --force
```

## 12. 后续路线图（v3+）

1. **真实微信 OAuth**：接入公众号扫码登录
2. **Web Push + 短信通知**：多渠道推送
3. **CLIP 向量检索**：替代直方图+哈希方案
4. **差分隐私位置模糊**：数学可证明的隐私保护
5. **联邦学习跨社区匹配**：多实例间隐私安全匹配
6. **地图 SDK 集成**：高德/腾讯地图，导航到代保管点
7. **小程序版本**：微信生态内完整体验
8. **机构 API 开放平台**：派出所/地铁/机场对接标准接口

## 13. 交接提醒

- v1 原始源码在 `C:\Users\33501\OneDrive\文档\New project`，v2 在 `d:\Trae_Solo_Project\拾寻`
- 所有 API 在 Supabase 配置缺失时自动降级为内存模式，demo 可正常演示
- JWT 密钥未显式配置时从 Supabase Key 派生，保证 demo 可用
- `api/_shared.js` 是所有后端 API 的公共依赖，修改时需同步测试
- 不要把 API key 写入代码、文档或 Git
- 修改前端后需重新部署 Vercel 才在线上生效
