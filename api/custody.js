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

// 预置代保管点种子数据（demo 用）- 北京市
const SEED_POINTS = [
  { id: "cp_001", name: "便利蜂·王府井店", address: "王府井大街 588 号", lat: 39.9145, lng: 116.4114, type: "convenience_store", operating_hours: "07:00-23:00" },
  { id: "cp_002", name: "丰巢智能柜·西单", address: "西单北大街 200 号 B1", lat: 39.9087, lng: 116.3743, type: "locker", operating_hours: "24h" },
  { id: "cp_003", name: "万科物业·朝阳城市花园", address: "朝阳路 100 弄物业中心", lat: 39.9248, lng: 116.4854, type: "property_office", operating_hours: "08:00-22:00" },
  { id: "cp_004", name: "全家·三里屯店", address: "三里屯路 1568 号", lat: 39.9335, lng: 116.4543, type: "convenience_store", operating_hours: "06:30-23:30" },
  { id: "cp_005", name: "丰巢智能柜·中关村地铁站", address: "中关村大街 1000 号 1 号口", lat: 39.9848, lng: 116.3165, type: "locker", operating_hours: "05:30-23:30" },
];

// 预置认证机构种子数据 - 北京市
const SEED_INSTITUTIONS = [
  { id: "inst_001", name: "北京地铁失物招领中心", type: "transit", verified: true, contact: "010-12345678", address: "王府井地铁站 B 出口" },
  { id: "inst_002", name: "王府井派出所", type: "police", verified: true, contact: "010-65231234", address: "王府井大街 410 号" },
  { id: "inst_003", name: "首都国际机场失物招领处", type: "airport", verified: true, contact: "010-64535856", address: "T3 航站楼 5F" },
  { id: "inst_004", name: "朝阳区市民服务中心", type: "government", verified: true, contact: "12345", address: "朝阳路 1075 号" },
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
    if (!memRow) {
      sendJson(res, 404, { error: "记录不存在" });
      return;
    }
    // owner_id 为空时禁止寄存，避免无主记录被任意操作
    if (!memRow.owner_id || memRow.owner_id !== current.sub) {
      sendJson(res, 403, { error: "只能寄存自己发布的记录" });
      return;
    }
    memRow.custody_point_id = pointId;
    memRow.pickup_code = pickupCode;
    memRow.item_status = "custody";
    memoryRecords.set(recordId, memRow);
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
    if (!checkResponse.ok) {
      sendJson(res, 500, { error: "校验记录失败" });
      return;
    }
    const rows = await checkResponse.json();
    const owner = rows[0]?.owner_id;
    if (!owner) {
      sendJson(res, 403, { error: "该记录无所有者，无法寄存" });
      return;
    }
    if (owner !== current.sub) {
      sendJson(res, 403, { error: "只能寄存自己发布的记录" });
      return;
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
      sendJson(res, 500, { error: "寄存失败，请稍后重试" });
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
    // 数据库异常时返回错误，不回退内存假装成功
    sendJson(res, 500, { error: "寄存操作失败，请稍后重试" });
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
    if (!memRow) {
      sendJson(res, 404, { error: "记录不存在" });
      return;
    }
    if (!memRow.pickup_code) {
      sendJson(res, 400, { error: "该记录尚未寄存" });
      return;
    }
    // 权限校验：只有发布者或认领者才能取件
    if (memRow.owner_id !== current.sub && memRow.claimed_by !== current.sub) {
      sendJson(res, 403, { error: "只有发布者或认领者才能取件" });
      return;
    }
    // 状态校验：只有 custody 状态才能取件
    if (memRow.item_status !== "custody") {
      sendJson(res, 400, { error: "该物品当前状态不允许取件" });
      return;
    }
    const expected = String(memRow.pickup_code).toUpperCase().replace(/-/g, "");
    const submitted = submittedCode.replace(/-/g, "");
    if (expected !== submitted) {
      sendJson(res, 400, { error: "取件码不正确" });
      return;
    }
    memRow.item_status = "picked";
    memRow.status = "已归还";
    memoryRecords.set(recordId, memRow);
    sendJson(res, 200, { ok: true });
    return;
  }

  try {
    const response = await supabaseFetch(
      config,
      `/rest/v1/${RECORDS_TABLE}?id=eq.${encodeURIComponent(recordId)}&select=owner_id,claimed_by,pickup_code,item_status&limit=1`,
      { method: "GET" },
    );
    if (!response.ok) {
      sendJson(res, 500, { error: "查询记录失败" });
      return;
    }
    const rows = await response.json();
    const record = rows[0];
    if (!record) {
      sendJson(res, 404, { error: "记录不存在" });
      return;
    }
    // 权限校验：只有发布者或认领者才能取件
    if (record.owner_id !== current.sub && record.claimed_by !== current.sub) {
      sendJson(res, 403, { error: "只有发布者或认领者才能取件" });
      return;
    }
    // 状态校验：只有 custody 状态才能取件，防止重复取件
    if (record.item_status !== "custody") {
      sendJson(res, 400, { error: "该物品当前状态不允许取件" });
      return;
    }
    const expected = String(record.pickup_code || "").toUpperCase().replace(/-/g, "");
    const submitted = submittedCode.replace(/-/g, "");
    if (!expected || expected !== submitted) {
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
    // 数据库异常时返回错误，不回退内存假装成功
    sendJson(res, 500, { error: "取件操作失败，请稍后重试" });
  }
}
