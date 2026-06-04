"use strict";

// 记录 CRUD API（v2 扩展版）
// GET    /api/records              列表（支持模糊化）
// POST   /api/records              创建（需登录，自动填充 owner_id）
// DELETE /api/records              删除（需登录 + owner 校验）
// PATCH  /api/records              更新状态（需登录）

const {
  getSupabaseConfig,
  supabaseFetch,
  readJsonBody,
  sendJson,
  getCurrentUser,
  safeErrorText,
} = require("./_shared");

const TABLE = "lost_found_records";
const memoryRecords = new Map();

const handler = async function handler(req, res) {
  try {
    if (req.method === "GET") return await handleList(req, res);
    if (req.method === "POST") return await handleCreate(req, res);
    if (req.method === "DELETE") return await handleDelete(req, res);
    if (req.method === "PATCH") return await handleUpdate(req, res);
    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, 500, { error: "Records API failed", detail: safeErrorText(error.message) });
  }
};

module.exports = handler;
module.exports.memoryRecords = memoryRecords;

async function handleList(req, res) {
  const current = getCurrentUser(req);
  const config = getSupabaseConfig();

  // 始终合并内存中的记录，确保 fallback 写入的记录也能被读到
  const memoryRows = Array.from(memoryRecords.values()).map((row) => fromMemoryRow(row, current));

  if (!config) {
    sendJson(res, 200, { records: memoryRows });
    return;
  }

  try {
    const response = await supabaseFetch(config, `/rest/v1/${TABLE}?select=*&order=created_at.desc`, { method: "GET" });
    const text = await response.text();
    if (!response.ok) {
      sendJson(res, 200, { records: memoryRows, fallback: true });
      return;
    }
    const rows = JSON.parse(text || "[]");
    const supabaseRecords = rows.map((row) => fromSupabaseRow(row, current)).filter(Boolean);
    // 合并 Supabase 和内存记录，以 Supabase 为准，内存中的新记录补充进去
    const supabaseIds = new Set(supabaseRecords.map((r) => r.id));
    const merged = [...supabaseRecords, ...memoryRows.filter((r) => r.id && !supabaseIds.has(r.id))];
    sendJson(res, 200, { records: merged });
  } catch (error) {
    sendJson(res, 200, { records: memoryRows, fallback: true });
  }
}

async function handleCreate(req, res) {
  const current = getCurrentUser(req);
  if (!current) {
    sendJson(res, 401, { error: "请先登录后再发布" });
    return;
  }
  const body = await readJsonBody(req);
  const record = normalizeRecord(body.record || body, current);
  const config = getSupabaseConfig();
  if (!config) {
    memoryRecords.set(record.id, toMemoryRow(record));
    sendJson(res, 200, { record });
    return;
  }
  try {
    const response = await supabaseFetch(config, `/rest/v1/${TABLE}`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(toSupabaseRow(record)),
    });
    const text = await response.text();
    if (!response.ok) {
      memoryRecords.set(record.id, toMemoryRow(record));
      sendJson(res, 200, { record, fallback: true });
      return;
    }
    const rows = JSON.parse(text || "[]");
    sendJson(res, 200, { record: fromSupabaseRow(rows[0], current) });
  } catch (error) {
    memoryRecords.set(record.id, toMemoryRow(record));
    sendJson(res, 200, { record, fallback: true });
  }
}

async function handleDelete(req, res) {
  const current = getCurrentUser(req);
  if (!current) {
    sendJson(res, 401, { error: "请先登录" });
    return;
  }
  const body = await readJsonBody(req);
  const id = String(body.id || "").trim();
  if (!id) {
    sendJson(res, 400, { error: "Missing record id" });
    return;
  }
  const config = getSupabaseConfig();
  if (!config) {
    const row = memoryRecords.get(id);
    if (!row) { sendJson(res, 404, { error: "记录不存在" }); return; }
    if (row.owner_id && row.owner_id !== current.sub) { sendJson(res, 403, { error: "只能删除自己发布的记录" }); return; }
    memoryRecords.delete(id);
    sendJson(res, 200, { ok: true });
    return;
  }
  try {
    const checkResponse = await supabaseFetch(
      config,
      `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&select=owner_id&limit=1`,
      { method: "GET" },
    );
    if (!checkResponse.ok) {
      const memRow = memoryRecords.get(id);
      if (memRow && memRow.owner_id && memRow.owner_id !== current.sub) {
        sendJson(res, 403, { error: "只能删除自己发布的记录" });
        return;
      }
      memoryRecords.delete(id);
      sendJson(res, 200, { ok: true, fallback: true });
      return;
    }
    const rows = await checkResponse.json();
    const owner = rows[0]?.owner_id;
    if (owner && owner !== current.sub) {
      sendJson(res, 403, { error: "只能删除自己发布的记录" });
      return;
    }
    if (!owner) {
      const memRow = memoryRecords.get(id);
      if (memRow) { memoryRecords.delete(id); sendJson(res, 200, { ok: true, fallback: true }); return; }
      sendJson(res, 403, { error: "记录不存在或无法验证所有权" });
      return;
    }
    await supabaseFetch(config, `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    memoryRecords.delete(id);
    sendJson(res, 200, { ok: true });
  } catch (error) {
    const memRow = memoryRecords.get(id);
    if (memRow && memRow.owner_id && memRow.owner_id !== current.sub) {
      sendJson(res, 403, { error: "只能删除自己发布的记录" });
      return;
    }
    memoryRecords.delete(id);
    sendJson(res, 200, { ok: true, fallback: true });
  }
}

async function handleUpdate(req, res) {
  const current = getCurrentUser(req);
  if (!current) {
    sendJson(res, 401, { error: "请先登录" });
    return;
  }
  const body = await readJsonBody(req);
  const id = String(body.id || "").trim();
  if (!id) {
    sendJson(res, 400, { error: "Missing record id" });
    return;
  }

  // 构建可编辑字段的 patch
  const patch = {};
  if (body.title !== undefined) patch.title = String(body.title).slice(0, 80);
  if (body.category !== undefined) patch.category = String(body.category).slice(0, 30);
  if (body.color !== undefined) patch.color = String(body.color).slice(0, 30);
  if (body.location !== undefined) patch.location = String(body.location).slice(0, 60);
  if (body.time !== undefined) patch.event_time = String(body.time).slice(0, 40);
  if (body.contact !== undefined) patch.contact = String(body.contact).slice(0, 120);
  if (body.description !== undefined) patch.description = String(body.description).slice(0, 800);
  if (body.status !== undefined) patch.status = String(body.status).slice(0, 30);
  if (body.item_status !== undefined) patch.item_status = String(body.item_status).slice(0, 20);
  if (body.custody_point_id !== undefined) patch.custody_point_id = String(body.custody_point_id).slice(0, 40);
  if (body.pickup_code !== undefined) patch.pickup_code = String(body.pickup_code).slice(0, 20);
  if (body.image_data !== undefined) patch.image_data = String(body.image_data);
  if (body.image_feature !== undefined) patch.image_feature = body.image_feature;
  if (body.semantic !== undefined) patch.semantic = body.semantic;

  if (!Object.keys(patch).length) {
    sendJson(res, 400, { error: "No fields to update" });
    return;
  }

  const config = getSupabaseConfig();
  if (!config) {
    const row = memoryRecords.get(id);
    if (!row) { sendJson(res, 404, { error: "记录不存在" }); return; }
    if (row.owner_id && row.owner_id !== current.sub) { sendJson(res, 403, { error: "只能更新自己发布的记录" }); return; }
    Object.assign(row, patch);
    memoryRecords.set(id, row);
    sendJson(res, 200, { ok: true, record: fromMemoryRow(row, current) });
    return;
  }
  try {
    const checkResponse = await supabaseFetch(
      config,
      `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&select=owner_id&limit=1`,
      { method: "GET" },
    );
    if (checkResponse.ok) {
      const rows = await checkResponse.json();
      const owner = rows[0]?.owner_id;
      if (owner && owner !== current.sub) {
        sendJson(res, 403, { error: "只能更新自己发布的记录" });
        return;
      }
    } else {
      const memRow = memoryRecords.get(id);
      if (memRow && memRow.owner_id && memRow.owner_id !== current.sub) {
        sendJson(res, 403, { error: "只能更新自己发布的记录" });
        return;
      }
    }
    await supabaseFetch(
      config,
      `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`,
      { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) },
    );
    const memRow = memoryRecords.get(id);
    if (memRow) { Object.assign(memRow, patch); memoryRecords.set(id, memRow); }
    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 200, { ok: true, fallback: true });
  }
}

function normalizeRecord(record, currentUser) {
  const now = new Date().toISOString();
  return {
    id: String(record.id || `record-${Date.now()}`),
    type: record.type === "found" ? "found" : "lost",
    title: String(record.title || "未命名物品").slice(0, 80),
    category: String(record.category || "其他").slice(0, 30),
    color: String(record.color || "未知").slice(0, 30),
    location: String(record.location || "未知地点").slice(0, 60),
    time: String(record.time || "").slice(0, 40),
    contact: String(record.contact || "").slice(0, 120),
    description: String(record.description || "").slice(0, 800),
    status: String(record.status || (record.type === "found" ? "待认领" : "待找回")).slice(0, 30),
    item_status: String(record.item_status || "unknown").slice(0, 20),
    custody_point_id: String(record.custody_point_id || "").slice(0, 40),
    pickup_code: String(record.pickup_code || "").slice(0, 20),
    owner_id: currentUser?.sub || record.owner_id || "",
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
    item_status: record.item_status,
    custody_point_id: record.custody_point_id,
    pickup_code: record.pickup_code,
    owner_id: record.owner_id,
    image_data: record.imageData,
    image_feature: record.imageFeature,
    semantic: record.semantic,
    created_at: record.createdAt,
  };
}

function fromSupabaseRow(row, currentUser) {
  if (!row) return null;
  const isOwner = currentUser?.sub && row.owner_id === currentUser.sub;
  const isVerified = currentUser?.verified;
  const shouldFuzzify = !isOwner && !isVerified;

  const record = {
    id: row.id,
    type: row.type,
    title: row.title,
    category: row.category,
    color: row.color,
    location: shouldFuzzify ? fuzzifyLocation(row.location) : row.location,
    time: shouldFuzzify ? fuzzifyTime(row.event_time) : row.event_time,
    // 联系方式：未认证使用特殊标记，前端据此渲染"查看联系方式"按钮
    contact: shouldFuzzify ? "__FUZZY_CONTACT__" : row.contact,
    description: shouldFuzzify ? fuzzifyDescription(row.description) : row.description,
    status: row.status,
    item_status: row.item_status || "unknown",
    custody_point_id: row.custody_point_id || "",
    pickup_code: isOwner ? (row.pickup_code || "") : "",
    owner_id: row.owner_id || "",
    imageData: shouldFuzzify ? "" : (row.image_data || ""),
    imageFeature: row.image_feature || null,
    semantic: row.semantic || null,
    createdAt: row.created_at,
    is_fuzzy: shouldFuzzify,
  };
  return record;
}

function toMemoryRow(record) {
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
    item_status: record.item_status,
    custody_point_id: record.custody_point_id,
    pickup_code: record.pickup_code,
    owner_id: record.owner_id,
    image_data: record.imageData,
    image_feature: record.imageFeature,
    semantic: record.semantic,
    created_at: record.createdAt,
  };
}

function fromMemoryRow(row, currentUser) {
  if (!row) return null;
  return fromSupabaseRow(row, currentUser);
}

// 模糊化函数
function fuzzifyLocation(location) {
  if (!location || location === "未知地点") return location;
  // 保留到"XX路附近"或"XX区"
  const roadMatch = location.match(/^(.+?[路道街巷])/);
  if (roadMatch) return `${roadMatch[1]}附近`;
  const districtMatch = location.match(/^(.+?[区县])/);
  if (districtMatch) return `${districtMatch[1]}范围内`;
  return `${location.slice(0, Math.max(2, location.length - 2))}附近`;
}

function fuzzifyTime(timeStr) {
  if (!timeStr) return "未知时间";
  try {
    const date = new Date(timeStr);
    const hour = date.getHours();
    const period = hour < 6 ? "凌晨" : hour < 12 ? "上午" : hour < 18 ? "下午" : "晚上";
    const dayDiff = Math.floor((Date.now() - date.getTime()) / 86400000);
    if (dayDiff === 0) return `今天${period}`;
    if (dayDiff === 1) return `昨天${period}`;
    if (dayDiff < 7) return `${dayDiff}天前${period}`;
    return `${date.getMonth() + 1}月${date.getDate()}日${period}`;
  } catch (error) {
    return "未知时间";
  }
}

function fuzzifyDescription(description) {
  if (!description) return "";
  // 保留前 30 字 + "..."
  const trimmed = description.trim();
  return trimmed.length > 30 ? `${trimmed.slice(0, 30)}...（实名认证后查看完整描述）` : trimmed;
}
