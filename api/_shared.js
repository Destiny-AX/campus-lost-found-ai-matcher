"use strict";

// 共享工具模块：环境变量读取、Supabase 请求、JWT 编解码、请求体解析等

const crypto = require("crypto");
const { execFileSync } = require("child_process");

// 读取环境变量，Windows 下兜底读取用户环境变量
function readEnv(name) {
  if (process.env[name]) return process.env[name];
  if (process.platform !== "win32") return "";
  try {
    // 对环境变量名做转义，防止单引号注入
    const safeName = name.replace(/'/g, "''");
    return execFileSync(
      "powershell.exe",
      ["-NoProfile", "-Command", `[Environment]::GetEnvironmentVariable('${safeName}','User')`],
      { encoding: "utf8", windowsHide: true, timeout: 3000 },
    ).trim();
  } catch (error) {
    return "";
  }
}

// 统一获取 Supabase 配置
function getSupabaseConfig() {
  const url = (
    readEnv("LOST_FOUND_SUPABASE_URL") ||
    readEnv("SUPABASE_URL") ||
    readEnv("supabase_url") ||
    ""
  ).replace(/\/$/, "");
  const key =
    readEnv("LOST_FOUND_SUPABASE_SERVICE_ROLE_KEY") ||
    readEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    readEnv("supabase_service_role_key") ||
    readEnv("SUPABASE_KEY") ||
    readEnv("supabase_key") ||
    readEnv("SUPABASE_ANON_KEY") ||
    readEnv("supabase_anon_key") ||
    "";
  if (!url || !key) return null;
  return { url, key };
}

// 获取 SiliconFlow API Key
function getSiliconFlowApiKey() {
  return (
    readEnv("LOST_FOUND_SILICON_FLOW_API_KEY") ||
    readEnv("silicon_flow_api_key") ||
    readEnv("SILICON_FLOW_API_KEY") ||
    readEnv("SILICONFLOW_API_KEY") ||
    ""
  ).trim();
}

// 获取或派生 JWT 签名密钥（无配置时用 Supabase Key 派生，保证 demo 可用）
let _jwtSecretCache = null;
function getJwtSecret() {
  if (_jwtSecretCache) return _jwtSecretCache;
  const explicit = readEnv("LOST_FOUND_JWT_SECRET") || readEnv("JWT_SECRET");
  if (explicit) { _jwtSecretCache = explicit; return explicit; }
  const config = getSupabaseConfig();
  if (config?.key) { _jwtSecretCache = crypto.createHash("sha256").update("shiyun-v2:" + config.key).digest("hex"); return _jwtSecretCache; }
  _jwtSecretCache = "shiyun-v2-demo-fallback-secret-do-not-use-in-production";
  return _jwtSecretCache;
}

// 简易 HS256 JWT 实现（避免引入外部依赖）
function base64UrlEncode(buffer) {
  return Buffer.from(buffer).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Buffer.from(padded, "base64");
}

function signJwt(payload, expiresInSeconds = 60 * 60 * 24 * 30) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { iat: now, exp: now + expiresInSeconds, ...payload };
  const headerSeg = base64UrlEncode(JSON.stringify(header));
  const payloadSeg = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${headerSeg}.${payloadSeg}`;
  const signature = crypto.createHmac("sha256", getJwtSecret()).update(signingInput).digest();
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

function verifyJwt(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerSeg, payloadSeg, signatureSeg] = parts;
  const expected = base64UrlEncode(
    crypto.createHmac("sha256", getJwtSecret()).update(`${headerSeg}.${payloadSeg}`).digest(),
  );
  if (expected !== signatureSeg) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(payloadSeg).toString("utf8"));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch (error) {
    return null;
  }
}

// 从请求中提取当前用户（Authorization: Bearer ...）
function getCurrentUser(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return verifyJwt(token);
}

// Supabase REST 请求封装
function supabaseFetch(config, path, options = {}) {
  return fetch(`${config.url}${path}`, {
    ...options,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

// 读取请求体（兼容 Vercel 已解析与原生 http 流）
async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      return {};
    }
  }
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (error) {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function safeErrorText(value) {
  return String(value || "").slice(0, 1200);
}

// 生成防混淆取件码字符（剔除 0/O/1/I/L）
const PICKUP_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generatePickupCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) out += PICKUP_ALPHABET[bytes[i] % PICKUP_ALPHABET.length];
  return `${out.slice(0, 2)}-${out.slice(2)}`;
}

module.exports = {
  readEnv,
  getSupabaseConfig,
  getSiliconFlowApiKey,
  getJwtSecret,
  signJwt,
  verifyJwt,
  getCurrentUser,
  supabaseFetch,
  readJsonBody,
  sendJson,
  safeErrorText,
  generatePickupCode,
};
