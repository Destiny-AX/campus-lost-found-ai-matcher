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
  // 去除 BOM 字符和前后空白
  const clean = (str) => (str || "").replace(/^\uFEFF/, "").trim();
  const url = clean(
    readEnv("LOST_FOUND_SUPABASE_URL") ||
    readEnv("SUPABASE_URL") ||
    readEnv("supabase_url") ||
    ""
  ).replace(/\/$/, "");
  const key = clean(
    readEnv("LOST_FOUND_SUPABASE_SERVICE_ROLE_KEY") ||
    readEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    readEnv("supabase_service_role_key") ||
    readEnv("SUPABASE_KEY") ||
    readEnv("supabase_key") ||
    readEnv("SUPABASE_ANON_KEY") ||
    readEnv("supabase_anon_key") ||
    ""
  );
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

// 获取或派生 JWT 签名密钥。未配置时仅为本地演示生成进程级随机密钥。
let _jwtSecretCache = null;
function getJwtSecret() {
  if (_jwtSecretCache) return _jwtSecretCache;
  const explicit = readEnv("LOST_FOUND_JWT_SECRET") || readEnv("JWT_SECRET");
  if (explicit) { _jwtSecretCache = explicit; return explicit; }
  const config = getSupabaseConfig();
  if (config?.key) { _jwtSecretCache = crypto.createHash("sha256").update("shiyun-v2:" + config.key).digest("hex"); return _jwtSecretCache; }
  _jwtSecretCache = crypto.randomBytes(32).toString("hex");
  console.warn("[security] LOST_FOUND_JWT_SECRET 未配置：已生成临时密钥，服务重启后登录态会失效。");
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
  // iat/exp 放在后面，防止 payload 中的 exp 字段覆盖过期时间
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds };
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
  // 使用常量时间比较签名，防止时序攻击
  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(signatureSeg);
  if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) return null;
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

// Supabase REST 请求封装（含超时控制）
function supabaseFetch(config, path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  return fetch(`${config.url}${path}`, {
    ...options,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
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
        // 兼容字符串 chunk（当 req.setEncoding 被设置时）和 Buffer chunk
        const body = chunks.length > 0 && typeof chunks[0] === "string"
          ? chunks.join("")
          : Buffer.concat(chunks).toString("utf8");
        resolve(JSON.parse(body || "{}"));
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

// ============== 统一输入校验工具 ==============

function validateString(value, options = {}) {
  const str = String(value || "").trim();
  if (options.required && !str) return { ok: false, error: options.name ? `${options.name}不能为空` : "字段不能为空" };
  if (options.minLength && str.length < options.minLength) return { ok: false, error: `${options.name || "字段"}长度不能少于${options.minLength}个字符` };
  if (options.maxLength && str.length > options.maxLength) return { ok: false, error: `${options.name || "字段"}长度不能超过${options.maxLength}个字符` };
  if (options.pattern && !options.pattern.test(str)) return { ok: false, error: options.patternError || `${options.name || "字段"}格式不正确` };
  if (options.enum && !options.enum.includes(str)) return { ok: false, error: `${options.name || "字段"}必须是以下之一：${options.enum.join("、")}` };
  return { ok: true, value: str };
}

function validateInt(value, options = {}) {
  const num = parseInt(value, 10);
  if (Number.isNaN(num)) return { ok: false, error: `${options.name || "字段"}必须是整数` };
  if (options.min !== undefined && num < options.min) return { ok: false, error: `${options.name || "字段"}不能小于${options.min}` };
  if (options.max !== undefined && num > options.max) return { ok: false, error: `${options.name || "字段"}不能大于${options.max}` };
  return { ok: true, value: num };
}

function validateArray(value, options = {}) {
  const arr = Array.isArray(value) ? value : [];
  if (options.required && arr.length === 0) return { ok: false, error: `${options.name || "字段"}不能为空数组` };
  if (options.maxLength && arr.length > options.maxLength) return { ok: false, error: `${options.name || "字段"}不能超过${options.maxLength}项` };
  return { ok: true, value: arr };
}

// ============== 简易内存限流器 ==============
// 基于用户ID或IP的滑动窗口限流，适用于 Serverless 环境
const _rateLimitMap = new Map();

function checkRateLimit(key, windowMs = 60000, maxRequests = 10) {
  const now = Date.now();
  const record = _rateLimitMap.get(key);
  if (!record) {
    _rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (now > record.resetAt) {
    _rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (record.count >= maxRequests) {
    return { ok: false, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
  }
  record.count += 1;
  return { ok: true };
}

// 定期清理过期的限流记录（每5分钟）
const rateLimitCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of _rateLimitMap.entries()) {
    if (now > record.resetAt) _rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000);
rateLimitCleanupTimer.unref?.();

// 生成防混淆取件码字符（剔除 0/O/1/I/L）
const PICKUP_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generatePickupCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) out += PICKUP_ALPHABET[bytes[i] % PICKUP_ALPHABET.length];
  return `${out.slice(0, 2)}-${out.slice(2)}`;
}

// 生成标准 UUID（通知表主键为 uuid 类型，需使用合法 UUID）
function generateUuid() {
  return crypto.randomUUID();
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
  generateUuid,
  validateString,
  validateInt,
  validateArray,
  checkRateLimit,
};
