"use strict";

// 代保管点 + 公共机构 API
// GET  /api/custody?action=points      获取代保管点列表
// GET  /api/custody?action=institutions 获取认证机构列表
// POST /api/custody?action=deposit     寄存物品 { record_id, point_id }  → 生成取件码
// POST /api/custody?action=pickup      取件 { record_id, pickup_code }    → 标记已取走

const {
  getSupabaseConfig,
  supabaseFetch,
  readJsonBody,
  sendJson,
  getCurrentUser,
  generatePickupCode,
  safeErrorText,
} = require("./_shared");

// 预置代保管点种子数据（demo 用）
const SEED_POINTS = [
  { id: "cp_001", name: "便利蜂·南京路店", address: "南京东路 588 号", lat: 31.2356, lng: 121.4794, type: "convenience_store", operating_hours: "07:00-23:00" },
  { id: "cp_002", name: "丰巢智能柜·人民广场", address: "人民大道 200 号 B1", lat: 31.2330, lng: 121.4737, type: "locker", operating_hours: "24h" },
  { id: "cp_003", name: "万科物业·城市花园", address: "长寿路 100 弄物业中心", lat: 31.2495, lng: 121.4416, type: "property_office", operating_hours: "08:00-22:00" },
  { id: "cp_004", name: "全家·静安寺店", address: "南京西路 1568 号", lat: 31.2235, lng: 121.4493, type: "convenience_store", operating_hours: "06:30-23:30" },
  { id: "cp_005", name: "丰巢智能柜·徐家汇地铁站", address: "肇嘉浜路 1000 号 1 号口", lat: 31.1948, lng: 121.4365, type: "locker", operating_hours: "05:30-23:30" },
];

// 预置认证机构种子数据
const SEED_INSTITUTIONS = [
  { id: "inst_001", name: "上海地铁失物招领中心", type: "transit", verified: true, contact: "021-12345678", address: "人民广场地铁站 B 出口" },
  { id: "inst_002", name: "南京东路派出所", type: "police", verified: true, contact: "021-63170110", address: "南京东路 410 号" },
  { id: "inst_003", name: "浦东国际机场失物招领处", type: "airport", verified: true, contact: "021-96990", address: "T2 航站楼 5F" },
  { id: "inst_004", name: "静安区市民服务中心", type: "government", verified: true, contact: "12345", address: "胶州路 1075 号" },
];

const POINTS_TABLE = "shiyun_custody_points";
const RECORDS_TABLE = "lost_found_records";
const { memoryRecords } = require("./records");

module.exports = async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const action = url.searchParams.get("action") || "points";

    if (action === "points") return handleListPoints(res);
    if (action === "institutions") return handleListInstitutions(res);
    if (action === "deposit") return handleDeposit(req, res);
    if (action === "pickup") return handlePickup(req, res);

    sendJson(res, 400, { error: "Unknown action" });
  } catch (error) {
    sendJson(res, 500, { error: "Custody API failed", detail: safeErrorText(error.message) });
  }
};

async function handleListPoints(res) {
  const config = getSupabaseConfig();
  if (!config) {
    sendJson(res, 200, { points: SEED_POINTS });
    return;
  }
  try {
    const response = await supabaseFetch(config, `/rest/v1/${POINTS_TABLE}?select=*&order=name.asc`, { method: "GET" });
    if (!response.ok) {
      sendJson(res, 200, { points: SEED_POINTS });
      return;
    }
    const rows = await response.json();
    sendJson(res, 200, { points: rows.length ? rows : SEED_POINTS });
  } catch (error) {
    sendJson(res, 200, { points: SEED_POINTS });
  }
}

function handleListInstitutions(res) {
  sendJson(res, 200, { institutions: SEED_INSTITUTIONS });
}

async function handleDeposit(req, res) {
  const current = getCurrentUser(req);
  if (!current) {
    sendJson(res, 401, { error: "请先登录" });
    return;
  }
  const body = await readJsonBody(req);
  const recordId = String(body.record_id || "").trim();
  const pointId = String(body.point_id || "").trim();
  if (!recordId || !pointId) {
    sendJson(res, 400, { error: "缺少 record_id 或 point_id" });
    return;
  }

  const pickupCode = generatePickupCode(6);
  const config = getSupabaseConfig();
  if (!config) {
    const memRow = memoryRecords.get(recordId);
    if (memRow) {
      if (memRow.owner_id && memRow.owner_id !== current.sub) {
        sendJson(res, 403, { error: "只能寄存自己发布的记录" });
        return;
      }
      memRow.custody_point_id = pointId;
      memRow.pickup_code = pickupCode;
      memRow.item_status = "custody";
      memoryRecords.set(recordId, memRow);
    }
    sendJson(res, 200, {
      ok: true,
      pickup_code: pickupCode,
      deposit_code: pickupCode.slice(0, 2),
      claim_code: pickupCode.slice(3),
      point_id: pointId,
    });
    return;
  }
  try {
    const checkResponse = await supabaseFetch(
      config,
      `/rest/v1/${RECORDS_TABLE}?id=eq.${encodeURIComponent(recordId)}&select=owner_id&limit=1`,
      { method: "GET" },
    );
    if (checkResponse.ok) {
      const rows = await checkResponse.json();
      const owner = rows[0]?.owner_id;
      if (owner && owner !== current.sub) {
        sendJson(res, 403, { error: "只能寄存自己发布的记录" });
        return;
      }
    }
    const patchResponse = await supabaseFetch(
      config,
      `/rest/v1/${RECORDS_TABLE}?id=eq.${encodeURIComponent(recordId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          custody_point_id: pointId,
          pickup_code: pickupCode,
          item_status: "custody",
        }),
      },
    );
    if (!patchResponse.ok) {
      const memRow = memoryRecords.get(recordId);
      if (memRow) { memRow.custody_point_id = pointId; memRow.pickup_code = pickupCode; memRow.item_status = "custody"; memoryRecords.set(recordId, memRow); }
      sendJson(res, 200, { ok: true, pickup_code: pickupCode, deposit_code: pickupCode.slice(0, 2), claim_code: pickupCode.slice(3), point_id: pointId, fallback: true });
      return;
    }
    const memRow = memoryRecords.get(recordId);
    if (memRow) { memRow.custody_point_id = pointId; memRow.pickup_code = pickupCode; memRow.item_status = "custody"; memoryRecords.set(recordId, memRow); }
    sendJson(res, 200, {
      ok: true,
      pickup_code: pickupCode,
      deposit_code: pickupCode.slice(0, 2),
      claim_code: pickupCode.slice(3),
      point_id: pointId,
    });
  } catch (error) {
    const memRow = memoryRecords.get(recordId);
    if (memRow) { memRow.custody_point_id = pointId; memRow.pickup_code = pickupCode; memRow.item_status = "custody"; memoryRecords.set(recordId, memRow); }
    sendJson(res, 200, { ok: true, pickup_code: pickupCode, deposit_code: pickupCode.slice(0, 2), claim_code: pickupCode.slice(3), point_id: pointId, fallback: true });
  }
}

async function handlePickup(req, res) {
  const current = getCurrentUser(req);
  if (!current) {
    sendJson(res, 401, { error: "请先登录" });
    return;
  }
  const body = await readJsonBody(req);
  const recordId = String(body.record_id || "").trim();
  const submittedCode = String(body.pickup_code || "").trim().toUpperCase();
  if (!recordId || !submittedCode) {
    sendJson(res, 400, { error: "缺少参数" });
    return;
  }

  const config = getSupabaseConfig();
  if (!config) {
    const memRow = memoryRecords.get(recordId);
    if (memRow && memRow.pickup_code) {
      const expected = String(memRow.pickup_code).toUpperCase().replace(/-/g, "");
      const submitted = submittedCode.replace(/-/g, "");
      if (expected !== submitted) {
        sendJson(res, 400, { error: "取件码不正确" });
        return;
      }
      memRow.item_status = "picked";
      memRow.status = "已归还";
      memoryRecords.set(recordId, memRow);
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  try {
    const response = await supabaseFetch(
      config,
      `/rest/v1/${RECORDS_TABLE}?id=eq.${encodeURIComponent(recordId)}&select=pickup_code&limit=1`,
      { method: "GET" },
    );
    if (!response.ok) {
      const memRow = memoryRecords.get(recordId);
      if (memRow && memRow.pickup_code) {
        const expected = String(memRow.pickup_code).toUpperCase().replace(/-/g, "");
        const submitted = submittedCode.replace(/-/g, "");
        if (expected !== submitted) { sendJson(res, 400, { error: "取件码不正确" }); return; }
        memRow.item_status = "picked"; memRow.status = "已归还"; memoryRecords.set(recordId, memRow);
      }
      sendJson(res, 200, { ok: true, fallback: true });
      return;
    }
    const rows = await response.json();
    const expected = String(rows[0]?.pickup_code || "").toUpperCase();
    if (!expected || expected !== submittedCode) {
      sendJson(res, 400, { error: "取件码不正确" });
      return;
    }
    await supabaseFetch(
      config,
      `/rest/v1/${RECORDS_TABLE}?id=eq.${encodeURIComponent(recordId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ item_status: "picked", status: "已归还" }),
      },
    );
    const memRow = memoryRecords.get(recordId);
    if (memRow) { memRow.item_status = "picked"; memRow.status = "已归还"; memoryRecords.set(recordId, memRow); }
    sendJson(res, 200, { ok: true });
  } catch (error) {
    const memRow = memoryRecords.get(recordId);
    if (memRow && memRow.pickup_code) {
      const expected = String(memRow.pickup_code).toUpperCase().replace(/-/g, "");
      const submitted = submittedCode.replace(/-/g, "");
      if (expected !== submitted) { sendJson(res, 400, { error: "取件码不正确" }); return; }
      memRow.item_status = "picked"; memRow.status = "已归还"; memoryRecords.set(recordId, memRow);
    }
    sendJson(res, 200, { ok: true, fallback: true });
  }
}
