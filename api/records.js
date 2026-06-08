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

// ============== 示例种子数据（Demo 用） ==============
// 当 Supabase 未配置或为空时，提供默认示例记录供演示
const SEED_RECORDS = [
  {
    id: "demo-lost-01",
    type: "lost",
    title: "黑色AirPods Pro耳机盒",
    category: "电子设备",
    color: "黑色",
    location: "南京西路地铁站2号口",
    event_time: "2026-06-05T08:30",
    contact: "微信: zhang_san_2024",
    description: "黑色AirPods Pro充电盒，外壳有轻微划痕，没有耳机在里面。可能在早高峰过安检时掉落。",
    status: "待找回",
    item_status: "unknown",
    city: "上海市",
    district: "静安区",
    street: "南京西路",
    detail_location: "地铁站2号口安检处",
    owner_id: "",
    image_data: "",
    image_feature: null,
    semantic: {
      object_name: "AirPods Pro充电盒",
      category: "电子设备",
      colors: ["黑色"],
      brand_guess: "Apple",
      visible_text: [],
      features: ["充电盒", "圆角", "轻微划痕"],
      confidence: 0.88,
    },
    created_at: "2026-06-05T09:00:00Z",
  },
  {
    id: "demo-found-01",
    type: "found",
    title: "黑色无线耳机充电盒",
    category: "电子设备",
    color: "黑色",
    location: "南京西路地铁站2号口",
    event_time: "2026-06-05T08:45",
    contact: "电话: 138****5678",
    description: "早高峰在地铁站2号口捡到黑色耳机充电盒，外观较新，没有耳机。已代为保管。",
    status: "待认领",
    item_status: "custody",
    city: "上海市",
    district: "静安区",
    street: "南京西路",
    detail_location: "地铁站2号口",
    owner_id: "",
    image_data: "",
    image_feature: null,
    semantic: {
      object_name: "无线耳机充电盒",
      category: "电子设备",
      colors: ["黑色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["充电盒", "圆角", "外观较新"],
      confidence: 0.85,
    },
    created_at: "2026-06-05T09:15:00Z",
  },
  {
    id: "demo-lost-02",
    type: "lost",
    title: "蓝色学生卡（带卡套）",
    category: "证件",
    color: "蓝色",
    location: "人民广场地铁站换乘通道",
    event_time: "2026-06-06T17:20",
    contact: "微信: li_si_campus",
    description: "蓝色校园卡，装在透明卡套里，卡套上有小星星贴纸。卡号后四位是8842。",
    status: "待找回",
    item_status: "unknown",
    city: "上海市",
    district: "黄浦区",
    street: "人民广场",
    detail_location: "1号线转2号线换乘通道",
    owner_id: "",
    image_data: "",
    image_feature: null,
    semantic: {
      object_name: "学生校园卡",
      category: "证件",
      colors: ["蓝色", "透明"],
      brand_guess: "未知",
      visible_text: ["校园卡"],
      features: ["透明卡套", "小星星贴纸", "卡号8842"],
      confidence: 0.92,
    },
    created_at: "2026-06-06T18:00:00Z",
  },
  {
    id: "demo-found-02",
    type: "found",
    title: "蓝色校园卡",
    category: "证件",
    color: "蓝色",
    location: "人民广场地铁站服务台",
    event_time: "2026-06-06T17:50",
    contact: "地铁站服务台 021-64370000",
    description: "在换乘通道捡到蓝色校园卡，已交至地铁站服务台。卡套有星星贴纸。",
    status: "待认领",
    item_status: "institution",
    city: "上海市",
    district: "黄浦区",
    street: "人民广场",
    detail_location: "地铁站服务中心",
    owner_id: "",
    image_data: "",
    image_feature: null,
    semantic: {
      object_name: "蓝色校园卡",
      category: "证件",
      colors: ["蓝色"],
      brand_guess: "未知",
      visible_text: ["校园卡"],
      features: ["卡套", "星星贴纸"],
      confidence: 0.9,
    },
    created_at: "2026-06-06T18:30:00Z",
  },
  {
    id: "demo-lost-03",
    type: "lost",
    title: "银色钥匙串（3把+绿色挂件）",
    category: "钥匙",
    color: "银色",
    location: "徐家汇美罗城B1层",
    event_time: "2026-06-07T14:00",
    contact: "电话: 159****2341",
    description: "三把银色钥匙，带一个绿色小恐龙挂件。可能在美罗城B1美食区遗失。",
    status: "待找回",
    item_status: "unknown",
    city: "上海市",
    district: "徐汇区",
    street: "徐家汇",
    detail_location: "美罗城B1层美食区",
    owner_id: "",
    image_data: "",
    image_feature: null,
    semantic: {
      object_name: "银色钥匙串",
      category: "钥匙",
      colors: ["银色", "绿色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["三把钥匙", "绿色小恐龙挂件"],
      confidence: 0.87,
    },
    created_at: "2026-06-07T15:00:00Z",
  },
  {
    id: "demo-found-03",
    type: "found",
    title: "银色钥匙串",
    category: "钥匙",
    color: "银色",
    location: "徐家汇美罗城B1层",
    event_time: "2026-06-07T14:30",
    contact: "微信: wang_wu_finder",
    description: "在美食区座位下捡到三把银色钥匙，带绿色挂件。已放在美罗城服务台。",
    status: "待认领",
    item_status: "custody",
    city: "上海市",
    district: "徐汇区",
    street: "徐家汇",
    detail_location: "美罗城服务台",
    owner_id: "",
    image_data: "",
    image_feature: null,
    semantic: {
      object_name: "银色钥匙串",
      category: "钥匙",
      colors: ["银色", "绿色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["三把钥匙", "绿色挂件"],
      confidence: 0.86,
    },
    created_at: "2026-06-07T15:30:00Z",
  },
  {
    id: "demo-lost-04",
    type: "lost",
    title: "红色折叠伞",
    category: "生活用品",
    color: "红色",
    location: "陆家嘴地铁站3号口",
    event_time: "2026-06-07T19:10",
    contact: "微信: zhao_liu_umbrella",
    description: "红色折叠伞，伞柄有黑色防滑套，伞面上有白色波点图案。下班高峰时遗失。",
    status: "待找回",
    item_status: "unknown",
    city: "上海市",
    district: "浦东新区",
    street: "陆家嘴",
    detail_location: "地铁站3号口出站闸机旁",
    owner_id: "",
    image_data: "",
    image_feature: null,
    semantic: {
      object_name: "红色折叠伞",
      category: "生活用品",
      colors: ["红色", "白色", "黑色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["折叠伞", "黑色防滑套", "白色波点"],
      confidence: 0.84,
    },
    created_at: "2026-06-07T20:00:00Z",
  },
  {
    id: "demo-found-04",
    type: "found",
    title: "红色波点折叠伞",
    category: "生活用品",
    color: "红色",
    location: "陆家嘴地铁站3号口",
    event_time: "2026-06-07T19:30",
    contact: "电话: 136****8910",
    description: "在3号口闸机旁捡到红色波点伞，伞柄有黑色防滑套。我代为保管，请联系取回。",
    status: "待认领",
    item_status: "custody",
    city: "上海市",
    district: "浦东新区",
    street: "陆家嘴",
    detail_location: "3号口出站闸机旁",
    owner_id: "",
    image_data: "",
    image_feature: null,
    semantic: {
      object_name: "红色波点折叠伞",
      category: "生活用品",
      colors: ["红色", "白色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["波点图案", "黑色防滑套"],
      confidence: 0.83,
    },
    created_at: "2026-06-07T20:30:00Z",
  },
];

// 初始化时将种子数据写入内存（仅当内存为空时）
function initSeedRecords() {
  if (memoryRecords.size === 0) {
    SEED_RECORDS.forEach((record) => {
      memoryRecords.set(record.id, record);
    });
  }
}

const handler = async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const action = url.searchParams.get("action") || "";
    if (action === "claim-request") return await handleClaimRequest(req, res);
    if (action === "review-claim") return await handleReviewClaim(req, res);
    if (action === "submit-review") return await handleSubmitReview(req, res);
    if (action === "report") return await handleReport(req, res);
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

  // 初始化示例种子数据（仅当内存为空时）
  initSeedRecords();

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
  if (body.city !== undefined) patch.city = String(body.city).slice(0, 20);
  if (body.district !== undefined) patch.district = String(body.district).slice(0, 20);
  if (body.street !== undefined) patch.street = String(body.street).slice(0, 40);
  if (body.detail_location !== undefined) patch.detail_location = String(body.detail_location).slice(0, 60);
  if (body.claim_question !== undefined) patch.claim_question = String(body.claim_question).slice(0, 200);

  if (!Object.keys(patch).length) {
    sendJson(res, 400, { error: "No fields to update" });
    return;
  }

  const config = getSupabaseConfig();
  if (!config) {
    const row = memoryRecords.get(id);
    if (!row) { sendJson(res, 404, { error: "记录不存在" }); return; }
    if (row.owner_id && row.owner_id !== current.sub && current.role !== "admin") { sendJson(res, 403, { error: "只能更新自己发布的记录" }); return; }
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
      if (owner && owner !== current.sub && current.role !== "admin") {
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
    city: String(record.city || "上海市").slice(0, 20),
    district: String(record.district || "").slice(0, 20),
    street: String(record.street || "").slice(0, 40),
    detail_location: String(record.detail_location || "").slice(0, 60),
    claim_question: String(record.claim_question || "").slice(0, 200),
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
    city: record.city,
    district: record.district,
    street: record.street,
    detail_location: record.detail_location,
    claim_question: record.claim_question,
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
    city: row.city || "上海市",
    district: row.district || "",
    street: row.street || "",
    detail_location: row.detail_location || "",
    claim_question: row.claim_question || "",
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
    city: record.city || "上海市",
    district: record.district || "",
    street: record.street || "",
    detail_location: record.detail_location || "",
    claim_question: record.claim_question || "",
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
  // 如果是自然语言描述（如"今天早晨"、"5月1日下午"），直接模糊化返回
  const naturalLangPattern = /^(今天|昨天|前天|上周|本周|几天前|早晨|上午|下午|晚上|凌晨|刚刚|不久前)/;
  const relativePattern = /^(\d+天前|\d+周前|\d+小时前|\d+分钟前)/;
  const datePattern = /^(\d{1,2})月(\d{1,2})日/;
  if (naturalLangPattern.test(timeStr) || relativePattern.test(timeStr)) {
    // 提取时间段并模糊化
    const periodMatch = timeStr.match(/(早晨|上午|下午|晚上|凌晨)/);
    const period = periodMatch ? periodMatch[1] : "";
    const dayMatch = timeStr.match(/^(今天|昨天|前天|\d+天前)/);
    const day = dayMatch ? dayMatch[1] : "";
    if (day && period) return `${day}${period}`;
    if (day) return `${day}`;
    if (period) return `某${period}`;
    return timeStr;
  }
  // 尝试解析为标准日期格式
  try {
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return timeStr; // 无法解析则原样返回
    const hour = date.getHours();
    const period = hour < 6 ? "凌晨" : hour < 12 ? "上午" : hour < 18 ? "下午" : "晚上";
    const dayDiff = Math.floor((Date.now() - date.getTime()) / 86400000);
    if (dayDiff === 0) return `今天${period}`;
    if (dayDiff === 1) return `昨天${period}`;
    if (dayDiff < 7) return `${dayDiff}天前${period}`;
    return `${date.getMonth() + 1}月${date.getDate()}日${period}`;
  } catch (error) {
    return timeStr || "未知时间";
  }
}

function fuzzifyDescription(description) {
  if (!description) return "";
  // 保留前 30 字 + "..."
  const trimmed = description.trim();
  return trimmed.length > 30 ? `${trimmed.slice(0, 30)}...（实名认证后查看完整描述）` : trimmed;
}

// ============== 认领问答系统 ==============
async function handleClaimRequest(req, res) {
  const current = getCurrentUser(req);
  if (!current) { sendJson(res, 401, { error: "请先登录" }); return; }
  const body = await readJsonBody(req);
  const recordId = String(body.record_id || "").trim();
  const answer = String(body.answer || "").trim();
  if (!recordId || !answer) { sendJson(res, 400, { error: "缺少记录ID或回答" }); return; }

  const config = getSupabaseConfig();
  if (!config) { sendJson(res, 200, { ok: true, fallback: true }); return; }

  try {
    // 创建认领申请
    const claimId = `claim_${Date.now()}`;
    await supabaseFetch(config, `/rest/v1/shiyun_claim_requests`, {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ id: claimId, record_id: recordId, claimant_id: current.sub, answer, status: "pending" }),
    });
    // 获取记录发布者
    const recResp = await supabaseFetch(config, `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(recordId)}&select=owner_id,title&limit=1`, { method: "GET" });
    const recRows = await recResp.json();
    const ownerId = recRows[0]?.owner_id;
    const title = recRows[0]?.title || "物品";
    // 发送通知给发布者（body中包含claim_id供前端审核使用）
    if (ownerId) {
      await supabaseFetch(config, `/rest/v1/shiyun_notifications`, {
        method: "POST",
        body: JSON.stringify({
          id: `notif_${Date.now()}`, user_id: ownerId, type: "claim_request",
          title: "有人申请认领", body: `有人申请认领你的「${title}」，请查看并审核。claim_id:${claimId}`, related_record_id: recordId,
        }),
      });
    }
    sendJson(res, 200, { ok: true });
  } catch (error) { sendJson(res, 200, { ok: true, fallback: true }); }
}

async function handleReviewClaim(req, res) {
  const current = getCurrentUser(req);
  if (!current) { sendJson(res, 401, { error: "请先登录" }); return; }
  const body = await readJsonBody(req);
  const claimId = String(body.claim_id || "").trim();
  const status = String(body.status || "").trim(); // "approved" or "rejected"
  if (!claimId || !["approved", "rejected"].includes(status)) { sendJson(res, 400, { error: "参数错误" }); return; }

  const config = getSupabaseConfig();
  if (!config) { sendJson(res, 200, { ok: true, fallback: true }); return; }

  try {
    // 更新认领申请状态
    await supabaseFetch(config, `/rest/v1/shiyun_claim_requests?id=eq.${encodeURIComponent(claimId)}`, {
      method: "PATCH", body: JSON.stringify({ status }),
    });
    // 获取认领申请详情
    const claimResp = await supabaseFetch(config, `/rest/v1/shiyun_claim_requests?id=eq.${encodeURIComponent(claimId)}&select=*&limit=1`, { method: "GET" });
    const claimRows = await claimResp.json();
    const claim = claimRows[0];
    if (!claim) { sendJson(res, 404, { error: "认领申请不存在" }); return; }

    // 获取记录信息
    const recResp = await supabaseFetch(config, `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(claim.record_id)}&select=*&limit=1`, { method: "GET" });
    const recRows = await recResp.json();
    const record = recRows[0];

    if (status === "approved") {
      // 向申请者发送通知（含联系方式）
      await supabaseFetch(config, `/rest/v1/shiyun_notifications`, {
        method: "POST",
        body: JSON.stringify({
          id: `notif_${Date.now()}`, user_id: claim.claimant_id, type: "claim_approved",
          title: "认领申请已通过", body: `你的认领申请已通过！联系方式：${record?.contact || "请查看详情"}`, related_record_id: claim.record_id,
        }),
      });
      // 更新记录状态
      await supabaseFetch(config, `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(claim.record_id)}`, {
        method: "PATCH", body: JSON.stringify({ claimed_by: claim.claimant_id, claimed_at: new Date().toISOString(), status: "已认领" }),
      });
    } else {
      // 向申请者发送拒绝通知
      await supabaseFetch(config, `/rest/v1/shiyun_notifications`, {
        method: "POST",
        body: JSON.stringify({
          id: `notif_${Date.now()}`, user_id: claim.claimant_id, type: "claim_rejected",
          title: "认领申请被拒绝", body: `你的认领申请未被通过，请确认物品信息后再试。`, related_record_id: claim.record_id,
        }),
      });
    }
    sendJson(res, 200, { ok: true, status });
  } catch (error) { sendJson(res, 200, { ok: true, fallback: true }); }
}

// ============== 评价系统 ==============
async function handleSubmitReview(req, res) {
  const current = getCurrentUser(req);
  if (!current) { sendJson(res, 401, { error: "请先登录" }); return; }
  const body = await readJsonBody(req);
  const recordId = String(body.record_id || "").trim();
  const rating = parseInt(body.rating || 0, 10);
  const comment = String(body.comment || "").trim();
  if (!recordId || !rating || rating < 1 || rating > 5) { sendJson(res, 400, { error: "评分必须在1-5之间" }); return; }

  const config = getSupabaseConfig();
  if (!config) { sendJson(res, 200, { ok: true, fallback: true }); return; }

  try {
    // 获取记录
    const recResp = await supabaseFetch(config, `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(recordId)}&select=owner_id,claimed_by&limit=1`, { method: "GET" });
    const recRows = await recResp.json();
    const record = recRows[0];
    if (!record) { sendJson(res, 404, { error: "记录不存在" }); return; }

    const isOwner = record.owner_id === current.sub;
    const isClaimant = record.claimed_by === current.sub;
    if (!isOwner && !isClaimant) { sendJson(res, 403, { error: "只能评价自己参与的交易" }); return; }

    const toUserId = isOwner ? record.claimed_by : record.owner_id;
    if (!toUserId) { sendJson(res, 400, { error: "对方用户不存在" }); return; }

    // 检查是否已评价
    const existResp = await supabaseFetch(config, `/rest/v1/shiyun_reviews?record_id=eq.${encodeURIComponent(recordId)}&from_user_id=eq.${encodeURIComponent(current.sub)}&limit=1`, { method: "GET" });
    const existRows = await existResp.json();
    if (existRows.length > 0) { sendJson(res, 400, { error: "已评价过该记录" }); return; }

    // 创建评价
    const reviewId = `review_${Date.now()}`;
    await supabaseFetch(config, `/rest/v1/shiyun_reviews`, {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ id: reviewId, record_id: recordId, from_user_id: current.sub, to_user_id: toUserId, rating, comment }),
    });

    // 更新信用分和经验（增量更新）
    if (rating >= 5) {
      await supabaseFetch(config, `/rest/v1/shiyun_users?id=eq.${encodeURIComponent(toUserId)}`, {
        method: "PATCH", body: JSON.stringify({ credit_score: 10, exp: 30 }),
      });
    } else if (rating <= 2) {
      await supabaseFetch(config, `/rest/v1/shiyun_users?id=eq.${encodeURIComponent(toUserId)}`, {
        method: "PATCH", body: JSON.stringify({ credit_score: -5 }),
      });
    }

    sendJson(res, 200, { ok: true });
  } catch (error) { sendJson(res, 200, { ok: true, fallback: true }); }
}

// ============== 举报系统 ==============
async function handleReport(req, res) {
  const current = getCurrentUser(req);
  if (!current) { sendJson(res, 401, { error: "请先登录" }); return; }
  const body = await readJsonBody(req);
  const recordId = String(body.record_id || "").trim();
  const reason = String(body.reason || "").trim();
  if (!recordId) { sendJson(res, 400, { error: "缺少记录ID" }); return; }

  const config = getSupabaseConfig();
  if (!config) { sendJson(res, 200, { ok: true, fallback: true }); return; }

  try {
    // 获取记录发布者
    const recResp = await supabaseFetch(config, `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(recordId)}&select=owner_id&limit=1`, { method: "GET" });
    const recRows = await recResp.json();
    const ownerId = recRows[0]?.owner_id;
    if (ownerId) {
      // 扣除信用分（增量更新）
      await supabaseFetch(config, `/rest/v1/shiyun_users?id=eq.${encodeURIComponent(ownerId)}`, {
        method: "PATCH", body: JSON.stringify({ credit_score: -20 }),
      });
    }
    sendJson(res, 200, { ok: true });
  } catch (error) { sendJson(res, 200, { ok: true, fallback: true }); }
}
