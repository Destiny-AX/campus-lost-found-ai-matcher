# Supabase Auth 邮箱密码账号说明

## 已实现范围

- 用户在“拾寻账号”弹窗使用邮箱、密码和昵称注册。
- 密码仅发送到项目服务端，再由服务端调用 Supabase Auth；业务数据库不保存密码或密码哈希。
- 登录成功后，Supabase Auth 用户 UUID 作为拾寻稳定用户 ID，复用现有发布、认领、通知、审核和归还权限链路。
- 支持邮箱确认开启/关闭两种配置：需要确认时，注册接口不签发应用登录令牌。
- Supabase 已配置时，生产游客登录返回 `410`；离线游客路由仅供 Smoke Test 使用。
- 微信登录入口及对应 API 路由已移除；权威实名仍是 Mock，不应与账号注册混淆。

## 服务端架构

```text
浏览器邮箱/密码
  -> POST /api/auth?action=password-register 或 password-login
  -> Supabase Auth /auth/v1/signup 或 /auth/v1/token
  -> Auth UUID 映射/创建 shiyun_users 资料
  -> 签发拾寻现有应用 JWT
  -> 原有 records / claim / notify / return 接口
```

Supabase 返回的 access token/refresh token 不发送给浏览器，也不写日志。现有业务 API 继续验证拾寻应用 JWT，这是本轮控制改动范围的兼容方案。

## 环境变量

仅在 Vercel Project Settings 或本地进程环境配置，不要写入仓库：

- `LOST_FOUND_SUPABASE_URL`
- `LOST_FOUND_SUPABASE_SERVICE_ROLE_KEY`
- `LOST_FOUND_SUPABASE_ANON_KEY`：推荐新增；仅由服务端调用 Auth。
- `LOST_FOUND_JWT_SECRET`

为兼容已有部署，Auth 在缺少 anon key 时可回退到已有服务端数据库 key；正式启用前仍建议单独配置 anon/publishable key，便于权限分离和轮换。

## Supabase 控制台设置

1. Authentication → Providers → Email：启用 Email provider。
2. 决定是否要求 Confirm email。面试双账号快速验收可以在隔离 Preview 中关闭；正式环境建议开启并配置 SMTP。
3. 若开启邮件确认，在 URL Configuration 中配置允许的 Preview/正式回跳地址。
4. 不需要新增密码字段；Supabase Auth 的 `auth.users` 负责凭证。
5. 现有 `public.shiyun_users.id`、`owner_id`、`claimant_id` 和 `user_id` 均为 text，可直接存 Auth UUID，不需要生产表迁移。

## 本地与 Preview 验证

离线契约测试（不会联网）：

```bash
npm run test:auth
```

Preview/隔离环境双账号：

1. 浏览器 A 注册邮箱 A，发布 `[INTERVIEW_TEST]` 招领记录。
2. 无痕窗口或浏览器 B 注册邮箱 B，查看候选并提交认领。
3. 浏览器 A 在通知中心审核。
4. 浏览器 B 确认归还，核对双方权限与状态变化。
5. 仅清理本轮带前缀的数据，不触碰其他记录。

本轮代码修改与离线测试不执行上述在线步骤，也不会向生产数据库写数据。

## 已知边界

- 当前密码认证是真实 Supabase Auth 接入，但应用会话仍是拾寻 JWT，不是完整透传的 Supabase Session。
- 应用 JWT 默认 30 天；Supabase 侧禁用账号、修改密码或登出其他设备，不能立即撤销已经签发的应用 JWT。
- 本地 `localStorage` 用于保存当前应用令牌和账号切换信息；生产化可改为 HttpOnly、Secure、SameSite Cookie。
- 限流是 Serverless 实例内存级，不能替代集中式防爆破设施；Supabase 自身限流仍生效。
- 邮件送达率、SMTP 配额、找回密码和账号注销尚未纳入基础版，不应在面试中宣称已实现。

## 面试表述

可表述为：“我没有自建密码表，而是用 Supabase Auth 管理邮箱凭证，使用 Auth UUID 贯穿发布者、认领者和通知权限；为了控制改造风险，本轮保留原应用 JWT，并明确记录会话即时撤销与 HttpOnly Cookie 是下一步安全项。”
