"use strict";

// 账号鉴权 API
// 路由：
//   POST /api/auth?action=wechat-login   { nickname, avatar_url, openid? }    Mock 微信登录
//   POST /api/auth?action=guest-login    { nickname? }                         游客登录
//   GET  /api/auth?action=me                                                   获取当前用户
//   POST /api/auth?action=verify-identity { real_name, id_card_last4 }         Mock 实名认证

const crypto = require("crypto");
const {
  getSupabaseConfig,
  supabaseFetch,
  readJsonBody,
  sendJson,
  signJwt,
  getCurrentUser,
  safeErrorText,
} = require("./_shared");

const USERS_TABLE = "shiyun_users";

// 内存兜底存储（Supabase 不可用时使用）
const memoryUsers = new Map();

module.exports = async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const action = url.searchParams.get("action") || "me";

    if (action === "me") return handleMe(req, res);
    if (action === "wechat-login") return handleWechatLogin(req, res);
    if (action === "guest-login") return handleGuestLogin(req, res);
    if (action === "verify-identity") return handleVerifyIdentity(req, res);

    sendJson(res, 400, { error: "Unknown action", action });
  } catch (error) {
    sendJson(res, 500, { error: "Auth API failed", detail: safeErrorText(error.message) });
  }
};

async function handleMe(req, res) {
  const current = getCurrentUser(req);
  if (!current) {
    sendJson(res, 401, { error: "Not authenticated" });
    return;
  }
  const user = await fetchUserById(current.sub);
  if (user) {
    sendJson(res, 200, { user });
  } else {
    sendJson(res, 200, { user: { id: current.sub, nickname: current.nickname, provider: current.provider, is_verified: current.verified || false } });
  }
}

async function handleWechatLogin(req, res) {
  const body = await readJsonBody(req);
  const nickname = String(body.nickname || "").trim() || `微信用户${randomSuffix()}`;
  const avatarUrl = String(body.avatar_url || "").trim();
  // demo 阶段 openid 自动生成；生产环境应通过 code 换取
  const openid = String(body.openid || "").trim() || `mock_openid_${crypto.randomBytes(8).toString("hex")}`;

  let user = await findUserByOpenid(openid);
  if (!user) {
    user = await createUser({
      nickname,
      avatar_url: avatarUrl,
      wechat_openid: openid,
      login_provider: "wechat_mock",
    });
  }
  const token = signJwt({ sub: user.id, nickname: user.nickname, provider: "wechat_mock" });
  sendJson(res, 200, { token, user });
}

async function handleGuestLogin(req, res) {
  const body = await readJsonBody(req);
  const nickname = String(body.nickname || "").trim() || `路人${randomSuffix()}`;
  const user = await createUser({
    nickname,
    avatar_url: "",
    wechat_openid: "",
    login_provider: "guest",
  });
  const token = signJwt({ sub: user.id, nickname: user.nickname, provider: "guest" });
  sendJson(res, 200, { token, user });
}

async function handleVerifyIdentity(req, res) {
  const current = getCurrentUser(req);
  if (!current) {
    sendJson(res, 401, { error: "Not authenticated" });
    return;
  }
  const body = await readJsonBody(req);
  const realName = String(body.real_name || "").trim();
  const idLast4 = String(body.id_card_last4 || "").trim();
  // demo 阶段 mock 校验：姓名 ≥ 2 字 + 末 4 位是数字
  if (realName.length < 2 || !/^\d{4}$/.test(idLast4)) {
    sendJson(res, 400, { error: "实名信息格式不正确（mock 校验）" });
    return;
  }
  const updated = await updateUser(current.sub, {
    is_verified: true,
    real_name_hash: crypto.createHash("sha256").update(realName + idLast4).digest("hex").slice(0, 16),
  });
  const token = signJwt({ sub: updated.id, nickname: updated.nickname, provider: current.provider, verified: true });
  sendJson(res, 200, { token, user: updated });
}

function randomSuffix() {
  return crypto.randomBytes(2).toString("hex");
}

// ============== 数据访问层（Supabase 优先，内存兜底） ==============

async function findUserByOpenid(openid) {
  if (!openid) return null;
  const config = getSupabaseConfig();
  if (!config) {
    for (const user of memoryUsers.values()) {
      if (user.wechat_openid === openid) return user;
    }
    return null;
  }
  try {
    const response = await supabaseFetch(
      config,
      `/rest/v1/${USERS_TABLE}?wechat_openid=eq.${encodeURIComponent(openid)}&select=*&limit=1`,
      { method: "GET" },
    );
    if (!response.ok) return null;
    const rows = await response.json();
    return rows[0] || null;
  } catch (error) {
    return null;
  }
}

async function fetchUserById(id) {
  if (!id) return null;
  const config = getSupabaseConfig();
  if (!config) return memoryUsers.get(id) || null;
  try {
    const response = await supabaseFetch(
      config,
      `/rest/v1/${USERS_TABLE}?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
      { method: "GET" },
    );
    if (!response.ok) return null;
    const rows = await response.json();
    return rows[0] || null;
  } catch (error) {
    return null;
  }
}

async function createUser(fields) {
  const id = `user_${crypto.randomBytes(8).toString("hex")}`;
  const now = new Date().toISOString();
  const record = {
    id,
    nickname: fields.nickname || "无名氏",
    avatar_url: fields.avatar_url || "",
    wechat_openid: fields.wechat_openid || "",
    login_provider: fields.login_provider || "guest",
    is_verified: false,
    real_name_hash: "",
    credit_score: 5,
    badges: ["🌱 新手上路"],
    is_institution: false,
    institution_name: "",
    created_at: now,
  };
  const config = getSupabaseConfig();
  if (!config) {
    memoryUsers.set(id, record);
    return record;
  }
  try {
    const response = await supabaseFetch(config, `/rest/v1/${USERS_TABLE}`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(record),
    });
    if (!response.ok) {
      memoryUsers.set(id, record);
      return record;
    }
    const rows = await response.json();
    return rows[0] || record;
  } catch (error) {
    memoryUsers.set(id, record);
    return record;
  }
}

async function updateUser(id, patch) {
  const config = getSupabaseConfig();
  if (!config) {
    const exist = memoryUsers.get(id) || { id };
    const merged = { ...exist, ...patch };
    memoryUsers.set(id, merged);
    return merged;
  }
  try {
    const response = await supabaseFetch(
      config,
      `/rest/v1/${USERS_TABLE}?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(patch),
      },
    );
    if (!response.ok) {
      const exist = memoryUsers.get(id) || { id };
      const merged = { ...exist, ...patch };
      memoryUsers.set(id, merged);
      return merged;
    }
    const rows = await response.json();
    return rows[0] || { id, ...patch };
  } catch (error) {
    const exist = memoryUsers.get(id) || { id };
    const merged = { ...exist, ...patch };
    memoryUsers.set(id, merged);
    return merged;
  }
}

// 导出供其他模块使用
module.exports.fetchUserById = fetchUserById;
module.exports.updateUser = updateUser;
