"use strict";

const { execFileSync } = require("child_process");

const TABLE = "lost_found_records";

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      await handleList(res);
      return;
    }

    if (req.method === "POST") {
      await handleCreate(req, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, 500, { error: "Records API failed", detail: safeErrorText(error.message) });
  }
};

async function handleList(res) {
  const config = getSupabaseConfig();
  if (!config) {
    sendJson(res, 503, { error: "Missing Supabase environment variables", fallback: true, records: [] });
    return;
  }

  const response = await supabaseFetch(config, `/rest/v1/${TABLE}?select=*&order=created_at.desc`, {
    method: "GET",
  });
  const text = await response.text();
  if (!response.ok) {
    sendJson(res, response.status, { error: "Supabase list failed", detail: safeErrorText(text), fallback: true, records: [] });
    return;
  }

  const rows = JSON.parse(text || "[]");
  sendJson(res, 200, { records: rows.map(fromSupabaseRow) });
}

async function handleCreate(req, res) {
  const config = getSupabaseConfig();
  if (!config) {
    sendJson(res, 503, { error: "Missing Supabase environment variables", fallback: true });
    return;
  }

  const body = await readJsonBody(req);
  const record = normalizeRecord(body.record || body);
  const response = await supabaseFetch(config, `/rest/v1/${TABLE}`, {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(toSupabaseRow(record)),
  });

  const text = await response.text();
  if (!response.ok) {
    sendJson(res, response.status, { error: "Supabase insert failed", detail: safeErrorText(text), fallback: true });
    return;
  }

  const rows = JSON.parse(text || "[]");
  sendJson(res, 200, { record: fromSupabaseRow(rows[0]) });
}

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
    readEnv("SUPABASE_ANON_KEY") ||
    readEnv("supabase_anon_key") ||
    "";
  if (!url || !key) return null;
  return { url, key };
}

function readEnv(name) {
  if (process.env[name]) return process.env[name];
  if (process.platform !== "win32") return "";
  try {
    return execFileSync(
      "powershell.exe",
      ["-NoProfile", "-Command", `[Environment]::GetEnvironmentVariable('${name}','User')`],
      { encoding: "utf8", windowsHide: true, timeout: 3000 },
    ).trim();
  } catch (error) {
    return "";
  }
}

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

function normalizeRecord(record) {
  const now = new Date().toISOString();
  return {
    id: String(record.id || `record-${Date.now()}`),
    type: record.type === "found" ? "found" : "lost",
    title: String(record.title || "未命名物品").slice(0, 80),
    category: String(record.category || "其他").slice(0, 30),
    color: String(record.color || "未知").slice(0, 30),
    location: String(record.location || "未知地点").slice(0, 60),
    time: String(record.time || now).slice(0, 40),
    contact: String(record.contact || "").slice(0, 120),
    description: String(record.description || "").slice(0, 800),
    status: String(record.status || (record.type === "found" ? "待认领" : "待找回")).slice(0, 30),
    imageData: String(record.imageData || ""),
    imageFeature: record.imageFeature || null,
    semantic: record.semantic || null,
    createdAt: String(record.createdAt || now),
  };
}

function toSupabaseRow(record) {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    category: record.category,
    color: record.color,
    location: record.location,
    event_time: record.time,
    contact: record.contact,
    description: record.description,
    status: record.status,
    image_data: record.imageData,
    image_feature: record.imageFeature,
    semantic: record.semantic,
    created_at: record.createdAt,
  };
}

function fromSupabaseRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    category: row.category,
    color: row.color,
    location: row.location,
    time: row.event_time,
    contact: row.contact,
    description: row.description,
    status: row.status,
    imageData: row.image_data || "",
    imageFeature: row.image_feature || null,
    semantic: row.semantic || null,
    createdAt: row.created_at,
  };
}

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

function safeErrorText(value) {
  return String(value || "").slice(0, 1200);
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}
