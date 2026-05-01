"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const recordsHandler = require("./api/records");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const MODEL = process.env.SILICON_FLOW_MODEL || "Qwen/Qwen3-VL-8B-Instruct";
const SILICON_FLOW_URL = process.env.SILICON_FLOW_BASE_URL || "https://api.siliconflow.cn/v1/chat/completions";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "POST" && url.pathname === "/api/analyze-image") {
      await handleAnalyzeImage(req, res);
      return;
    }

    if ((req.method === "GET" || req.method === "POST") && url.pathname === "/api/records") {
      await recordsHandler(req, res);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    serveStatic(url.pathname, res, req.method === "HEAD");
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`校园失物招领 AI 智能匹配程序已启动: http://localhost:${PORT}`);
});

async function handleAnalyzeImage(req, res) {
  const apiKey = getSiliconFlowApiKey();
  if (!apiKey) {
    sendJson(res, 503, {
      error: "Missing silicon_flow_api_key environment variable",
      fallback: true,
    });
    return;
  }

  const body = await readJsonBody(req, 8 * 1024 * 1024);
  const imageData = String(body.imageData || "");
  if (!imageData.startsWith("data:image/")) {
    sendJson(res, 400, { error: "imageData must be a base64 image data URL" });
    return;
  }

  const prompt = [
    "你是校园失物招领系统中的图片语义识别模块。",
    "请只输出 JSON，不要解释，不要 Markdown。",
    "从图片中识别物品，用于后续失物与招领匹配。",
    "字段要求：",
    "{",
    '  "object_name": "最可能的物品名称，例如 无线耳机盒/校园卡/钥匙串",',
    '  "category": "证件/电子设备/生活用品/学习用品/钥匙/其他",',
    '  "colors": ["主要颜色"],',
    '  "brand_guess": "可见品牌或未知",',
    '  "visible_text": ["图片中可见文字，无法识别则空数组"],',
    '  "features": ["形状、材质、贴纸、划痕、挂件等可区分特征"],',
    '  "confidence": 0.0',
    "}",
    "confidence 使用 0 到 1 的数字。",
  ].join("\n");

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
    });
  } catch (error) {
    sendJson(res, 502, {
      error: "SiliconFlow request unavailable",
      detail: safeErrorText(error.message),
      fallback: true,
    });
    return;
  }

  const raw = await response.text();
  if (!response.ok) {
    sendJson(res, response.status, {
      error: "SiliconFlow request failed",
      detail: safeErrorText(raw),
    });
    return;
  }

  try {
    const payload = JSON.parse(raw);
    const content = payload.choices?.[0]?.message?.content || "{}";
    sendJson(res, 200, {
      model: MODEL,
      semantic: normalizeSemanticResult(parsePossiblyFencedJson(content)),
    });
  } catch (error) {
    sendJson(res, 502, {
      error: "Failed to parse model response",
      detail: safeErrorText(raw),
    });
  }
}

function serveStatic(pathname, res, headOnly) {
  const normalized = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(ROOT, normalized));
  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    const type = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(headOnly ? undefined : data);
  });
}

function getSiliconFlowApiKey() {
  const inherited = (
    process.env.silicon_flow_api_key ||
    process.env.SILICON_FLOW_API_KEY ||
    process.env.SILICONFLOW_API_KEY ||
    ""
  ).trim();
  if (inherited) return inherited;

  if (process.platform === "win32") {
    try {
      return execFileSync(
        "powershell.exe",
        ["-NoProfile", "-Command", "[Environment]::GetEnvironmentVariable('silicon_flow_api_key','User')"],
        { encoding: "utf8", windowsHide: true, timeout: 3000 },
      ).trim();
    } catch (error) {
      return "";
    }
  }

  return "";
}

function readJsonBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

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

function safeErrorText(value) {
  return String(value || "").slice(0, 1200);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}
