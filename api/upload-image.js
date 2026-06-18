"use strict";

// 图片上传 API：接收 Base64 图片，上传到 Supabase Storage，返回公开 URL
// POST /api/upload-image

const { getSupabaseConfig, readJsonBody, sendJson, safeErrorText, getCurrentUser } = require("./_shared");
const https = require("https");
const crypto = require("crypto");

const BUCKET_NAME = "lost-found-images";

const handler = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    // 鉴权：必须登录才能上传图片
    const current = getCurrentUser(req);
    if (!current) {
      sendJson(res, 401, { error: "请先登录" });
      return;
    }

    const body = await readJsonBody(req);
    const { imageData, recordId } = body;

    if (!imageData || typeof imageData !== "string") {
      sendJson(res, 400, { error: "Missing imageData" });
      return;
    }

    // 解析 Base64 数据
    const match = imageData.match(/^data:(image\/(\w+));base64,(.+)$/);
    if (!match) {
      sendJson(res, 400, { error: "Invalid imageData format" });
      return;
    }

    const mimeType = match[1];
    const ext = match[2] === "jpeg" ? "jpg" : match[2];
    const base64Data = match[3];
    // 校验MIME类型白名单，防止上传非图片文件
    const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"];
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      sendJson(res, 400, { error: "不支持的图片格式，仅允许 JPG/PNG/GIF/WebP/BMP" });
      return;
    }
    const buffer = Buffer.from(base64Data, "base64");

    // 限制大小 5MB
    if (buffer.length > 5 * 1024 * 1024) {
      sendJson(res, 413, { error: "Image too large, max 5MB" });
      return;
    }

    const config = getSupabaseConfig();
    if (!config) {
      // 无 Supabase 配置，返回原始 Base64
      sendJson(res, 200, { url: imageData, fallback: true });
      return;
    }

    // 生成文件名：recordId/随机串.扩展名
    const fileName = `${recordId || "temp"}/${crypto.randomUUID()}.${ext}`;

    // 上传到 Supabase Storage
    const uploadResult = await uploadToStorage(config, fileName, buffer, mimeType);
    if (!uploadResult.ok) {
      sendJson(res, 500, { error: "Upload failed", detail: uploadResult.error });
      return;
    }

    // 获取公开 URL
    const publicUrl = `${config.url}/storage/v1/object/public/${BUCKET_NAME}/${fileName}`;

    sendJson(res, 200, { url: publicUrl, path: fileName });
  } catch (error) {
    sendJson(res, 500, { error: "Upload failed", detail: safeErrorText(error.message) });
  }
};

async function uploadToStorage(config, fileName, buffer, mimeType) {
  return new Promise((resolve) => {
    const options = {
      hostname: new URL(config.url).hostname,
      path: `/storage/v1/object/${BUCKET_NAME}/${fileName}`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.key}`,
        apikey: config.key,
        "Content-Type": mimeType,
        "Content-Length": buffer.length,
        "x-upsert": "true",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true });
        } else {
          resolve({ ok: false, error: data });
        }
      });
    });

    req.on("error", (err) => resolve({ ok: false, error: err.message }));
    req.write(buffer);
    req.end();
  });
}

module.exports = handler;
