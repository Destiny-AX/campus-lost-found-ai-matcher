# 在线模型模式兼容性

状态：代码路径已检查；本轮未提供真实 Key，未调用线上模型。

- 文本入口：`api/structured-input.js`。有 Key 时依次调用 `deepseek-ai/DeepSeek-V4-Flash` 与 `Qwen/Qwen3-8B`；25 秒超时；兼容 `content` / `reasoning_content`；解析或请求失败回退启发式。
- 视觉入口：`api/analyze-image.js`。模型仍为 `Qwen/Qwen3-VL-8B-Instruct`；30 秒超时；缺 Key 返回可识别的 fallback 标记，前端继续使用浏览器本地图像特征。
- API：仍使用 SiliconFlow `/v1/chat/completions`，低温度、JSON 响应格式。未改默认模型名、Base URL 或原有环境变量；新增 `LOST_FOUND_TIME_ZONE` 仅用于相对时间。
- Key 兼容：优先 `LOST_FOUND_SILICON_FLOW_API_KEY`，兼容 `silicon_flow_api_key`、`SILICON_FLOW_API_KEY`、`SILICONFLOW_API_KEY`。
- 在线模式选择：Key 非空即优先真实 HTTP 调用；空值走规则降级。真实接口未被 Mock 覆盖。
- 本轮验证等级：请求代码/参数/响应解析/超时/降级已检查；真实响应、配额、时延和模型效果均未在线验证。
