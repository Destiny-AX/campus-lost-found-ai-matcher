"use strict";

const {
  getSiliconFlowApiKey,
  readJsonBody,
  sendJson,
  safeErrorText,
  getCurrentUser,
} = require("./_shared");

const MODEL = process.env.SILICON_FLOW_MODEL || "Qwen/Qwen3-VL-8B-Instruct";
const SILICON_FLOW_URL = process.env.SILICON_FLOW_BASE_URL || "https://api.siliconflow.cn/v1/chat/completions";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  // 鉴权：必须登录才能调用 AI 分析，避免匿名滥用付费 API
  const current = getCurrentUser(req);
  if (!current) {
    sendJson(res, 401, { error: "请先登录" });
    return;
  }

  try {
    const apiKey = getSiliconFlowApiKey();
    if (!apiKey) {
      sendJson(res, 503, {
        error: "Missing silicon_flow_api_key environment variable",
        fallback: true,
      });
      return;
    }

    const body = await readJsonBody(req);
    const imageData = String(body.imageData || "");
    if (!imageData.startsWith("data:image/")) {
      sendJson(res, 400, { error: "imageData must be a base64 image data URL" });
      return;
    }

    const prompt = [
      "你是城市失物招领系统中的图片语义识别模块。",
      "请只输出 JSON，不要解释，不要 Markdown。",
      "从图片中识别物品，用于后续失物与招领匹配。",
      "字段要求：",
      "{",
      '  "object_name": "最可能的物品名称，例如 无线耳机盒/身份证/钥匙串",',
      '  "category": "证件/电子设备/生活用品/学习用品/钥匙/箱包/贵重物品/其他",',
      '  "colors": ["主要颜色"],',
      '  "brand_guess": "可见品牌或未知",',
      '  "visible_text": ["图片中可见文字，无法识别则空数组"],',
      '  "features": ["形状、材质、贴纸、划痕、挂件等可区分特征"],',
      '  "confidence": 0.0',
      "}",
      "confidence 使用 0 到 1 的数字。",
    ].join("\n");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
      response = await fetch(SILICON_FLOW_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: imageData, detail: "low" } },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 600,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      sendJson(res, 502, {
        error: "SiliconFlow request unavailable",
        detail: safeErrorText(error.message),
        fallback: true,
      });
      return;
    }
    clearTimeout(timeout);

    const raw = await response.text();
    if (!response.ok) {
      sendJson(res, response.status, {
        error: "SiliconFlow request failed",
        detail: safeErrorText(raw),
        fallback: true,
      });
      return;
    }

    try {
      const payload = JSON.parse(raw);
      const message = payload.choices?.[0]?.message || {};
      // 兼容 Qwen3 思考模式：content 为空时回退 reasoning_content
      let content = message.content || "";
      if (!content && message.reasoning_content) {
        const jsonMatch = message.reasoning_content.match(/\{[\s\S]*\}/);
        if (jsonMatch) content = jsonMatch[0];
      }
      sendJson(res, 200, {
        model: MODEL,
        semantic: normalizeSemanticResult(parsePossiblyFencedJson(content)),
      });
    } catch (error) {
      sendJson(res, 502, {
        error: "Failed to parse model response",
        detail: safeErrorText(raw),
        fallback: true,
      });
    }
  } catch (error) {
    // 顶层异常兜底，避免未处理异常导致进程崩溃
    sendJson(res, 500, { error: "图像分析失败", detail: safeErrorText(error.message) });
  }
};

function parsePossiblyFencedJson(value) {
  const text = String(value || "").trim();
  if (text.startsWith("{")) return JSON.parse(text);
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (match) return JSON.parse(match[1]);
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) return JSON.parse(objectMatch[0]);
  return {};
}

function normalizeSemanticResult(value) {
  const semantic = value && typeof value === "object" ? value : {};
  return {
    object_name: String(semantic.object_name || "未知物品").slice(0, 40),
    category: String(semantic.category || "其他").slice(0, 20),
    colors: toArray(semantic.colors).slice(0, 5),
    brand_guess: String(semantic.brand_guess || "未知").slice(0, 40),
    visible_text: toArray(semantic.visible_text).slice(0, 8),
    features: toArray(semantic.features).slice(0, 10),
    confidence: clampNumber(Number(semantic.confidence), 0, 1, 0.5),
  };
}

function toArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
