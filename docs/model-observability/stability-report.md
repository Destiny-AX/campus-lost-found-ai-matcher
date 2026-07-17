# 模型稳定性小样本报告

## 本轮真实调用结果

本冲刺未执行真实 provider 调用，因此 AI 成功、模型降级、规则兜底、超时、P50 和 P95 均标记为“未计算”。这不是遗漏数据后填 0，而是遵守以下边界后的阻塞结果：

- 生产接口要求登录；不能读取或复制浏览器 Cookie/JWT。
- 为拿 token 新建生产测试用户会产生生产写入，本轮没有这样做。
- Vercel 当前只确认了 Production 范围的敏感变量，没有独立 Preview 模型变量。
- 尝试通过既有浏览器会话进行无发布调用时，本地 WebBridge 无法连接；没有继续绕过登录态。

## 已执行的确定性可观测性测试

`npm run test:observability`：8/8 通过。

- 主模型成功：返回 `source=ai`、模型、耗时和完整状态。
- 主模型超时：只降级一次，备用模型成功。
- 429：视为临时错误并降级一次。
- 非重试 4xx：不消耗第二次模型调用，进入规则。
- JSON/字段解析失败：记录 `parse_status=failed` 并降级一次。
- 两模型超时：返回 `heuristic_fallback`，模型字段为空。
- 日志脱敏：attempts 不含测试 Key 或用户原文。
- 前端：详细区只在 interview/debug 模式展示且默认折叠。

这些是控制流和契约证据，不是供应商稳定性数据，不能计算 P50/P95。

## 建议的安全复测条件

在 Vercel Preview 配置单独的低额度模型 Key，并使用不落库的测试身份或专用 Preview 认证。固定 6—8 条无隐私输入，每条调用一次，导出响应中的 request_id、source、model、latency_ms、attempts、fallback_reason、provider_status、parse_status；随后按真实样本计算 P50/P95。总调用数仍控制在 10 次以内。

