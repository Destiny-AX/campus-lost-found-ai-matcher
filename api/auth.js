"use strict";

// 账号鉴权 API
// 路由：
//   POST /api/auth?action=password-register { email, password, nickname? }     邮箱注册
//   POST /api/auth?action=password-login    { email, password }                邮箱登录
//   POST /api/auth?action=guest-login       { nickname? }                      仅离线测试兜底
//   GET  /api/auth?action=me                                                   获取当前用户
//   POST /api/auth?action=verify-identity { real_name, id_card_last4 }         Mock 实名认证

const crypto = require("crypto");
const {
  getSupabaseConfig,
  getSupabaseAuthConfig,
  supabaseFetch,
  readJsonBody,
  sendJson,
  signJwt,
  getCurrentUser,
  safeErrorText,
  checkRateLimit,
} = require("./_shared");

const USERS_TABLE = "shiyun_users";

// 内存兜底存储（Supabase 不可用时使用）
const memoryUsers = new Map();

// 徽章定义
const BADGE_DEFS = {
  "newbie": { emoji: "🌱", name: "新手上路", rarity: "common", desc: "加入拾寻" },
  "verified": { emoji: "✅", name: "实名认证", rarity: "rare", desc: "完成实名认证" },
  "first_publish": { emoji: "📝", name: "初次发布", rarity: "common", desc: "首次发布信息" },
  "match_master": { emoji: "🎯", name: "匹配达人", rarity: "rare", desc: "产生一次80%+匹配" },
  "helper": { emoji: "🤝", name: "助人为乐", rarity: "epic", desc: "帮助找回1件物品" },
  "streak7": { emoji: "🔥", name: "连续活跃", rarity: "rare", desc: "连续7天登录" },
  "guardian": { emoji: "🏆", name: "城市守护者", rarity: "legendary", desc: "等级达到7级" },
};

function calculateLevel(exp) {
  return Math.max(1, Math.floor(1 + Math.sqrt(exp / 100)));
}

function getExpForNextLevel(level) {
  return Math.pow(level, 2) * 100;
}

function getLevelTitle(level) {
  if (level <= 2) return "拾遗新手";
  if (level <= 4) return "热心市民";
  if (level <= 6) return "城市好心人";
  if (level <= 8) return "拾金不昧达人";
  return "城市守护者";
}

module.exports = async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const action = url.searchParams.get("action") || "me";

    // 限流：登录类接口每IP每分钟最多10次
    if (["password-register", "password-login", "guest-login", "verify-identity"].includes(action)) {
      const clientIp = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
      const limit = checkRateLimit(`auth:${clientIp}`, 60000, 10);
      if (!limit.ok) {
        sendJson(res, 429, { error: "请求过于频繁，请稍后再试", retryAfter: limit.retryAfter });
        return;
      }
    }

    if (action === "me") return handleMe(req, res);
    if (action === "password-register") return handlePasswordRegister(req, res);
    if (action === "password-login") return handlePasswordLogin(req, res);
    if (action === "guest-login") return handleGuestLogin(req, res);
    if (action === "verify-identity") return handleVerifyIdentity(req, res);
    if (action === "add-exp") return handleAddExp(req, res);
    if (action === "unlock-badge") return handleUnlockBadge(req, res);
    if (action === "check-streak") return handleCheckStreak(req, res);

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

function validatePasswordInput(body, requireNickname = false) {
  const email = String(body.email || "").trim().toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const nickname = String(body.nickname || "").trim();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "请输入有效的邮箱地址" };
  }
  if (password.length < 8 || password.length > 72) {
    return { ok: false, error: "密码长度需为 8—72 位" };
  }
  if (requireNickname && (nickname.length < 2 || nickname.length > 30)) {
    return { ok: false, error: "昵称长度需为 2—30 个字符" };
  }
  return { ok: true, email, password, nickname };
}

async function callSupabaseAuth(config, path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${config.url}${path}`, {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let payload = {};
    try { payload = await response.json(); } catch (error) { payload = {}; }
    return { ok: response.ok, status: response.status, payload };
  } finally {
    clearTimeout(timeout);
  }
}

function mapProviderError(result, action) {
  const message = String(
    result?.payload?.msg ||
    result?.payload?.message ||
    result?.payload?.error_description ||
    result?.payload?.error ||
    ""
  ).toLowerCase();
  if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
    return "该邮箱已注册，请直接登录";
  }
  if (message.includes("email not confirmed")) return "请先完成邮箱验证，再登录";
  if (action === "login" && (result?.status === 400 || result?.status === 401 || result?.status === 422)) {
    return "邮箱或密码错误";
  }
  if (result?.status === 429) return "尝试次数过多，请稍后再试";
  return "账号服务暂时不可用，请稍后重试";
}

async function ensurePasswordProfile(providerUser, nickname) {
  const existing = await fetchUserById(providerUser.id);
  if (existing) return existing;
  const fallbackNickname = String(providerUser.email || "拾寻用户").split("@")[0].slice(0, 30) || "拾寻用户";
  return createUser({
    id: providerUser.id,
    nickname: nickname || providerUser.user_metadata?.nickname || fallbackNickname,
    avatar_url: "",
    wechat_openid: "",
    login_provider: "password",
    role: "user",
  });
}

function sendPasswordSession(res, providerPayload, profile) {
  const providerUser = providerPayload.user;
  const user = {
    ...profile,
    id: providerUser.id,
    sub: providerUser.id,
    provider: "password",
    email_confirmed: Boolean(providerUser.email_confirmed_at || providerUser.confirmed_at),
  };
  const token = signJwt({
    sub: user.id,
    nickname: user.nickname,
    provider: "password",
    verified: Boolean(user.is_verified),
    role: user.role || "user",
  });
  sendJson(res, 200, { token, user });
}

async function handlePasswordRegister(req, res) {
  const body = await readJsonBody(req);
  const input = validatePasswordInput(body, true);
  if (!input.ok) return sendJson(res, 400, { error: input.error });
  const config = getSupabaseAuthConfig();
  if (!config) return sendJson(res, 503, { error: "邮箱账号服务尚未配置" });
  try {
    const result = await callSupabaseAuth(config, "/auth/v1/signup", {
      email: input.email,
      password: input.password,
      data: { nickname: input.nickname },
    });
    if (!result.ok || !result.payload?.user?.id) {
      return sendJson(res, result.status >= 400 && result.status < 500 ? result.status : 502, {
        error: mapProviderError(result, "register"),
      });
    }
    if (!(result.payload.access_token || result.payload.session?.access_token)) {
      return sendJson(res, 202, {
        ok: true,
        confirmation_required: true,
        message: "注册成功，请查收验证邮件后再登录",
      });
    }
    const profile = await ensurePasswordProfile(result.payload.user, input.nickname);
    return sendPasswordSession(res, result.payload, profile);
  } catch (error) {
    const message = error?.name === "AbortError" ? "账号服务响应超时，请稍后重试" : "账号服务连接失败，请稍后重试";
    return sendJson(res, error?.name === "AbortError" ? 504 : 502, { error: message });
  }
}

async function handlePasswordLogin(req, res) {
  const body = await readJsonBody(req);
  const input = validatePasswordInput(body, false);
  if (!input.ok) return sendJson(res, 400, { error: input.error });
  const config = getSupabaseAuthConfig();
  if (!config) return sendJson(res, 503, { error: "邮箱账号服务尚未配置" });
  try {
    const result = await callSupabaseAuth(config, "/auth/v1/token?grant_type=password", {
      email: input.email,
      password: input.password,
    });
    if (!result.ok || !result.payload?.user?.id || !result.payload?.access_token) {
      return sendJson(res, result.status >= 400 && result.status < 500 ? result.status : 502, {
        error: mapProviderError(result, "login"),
      });
    }
    const profile = await ensurePasswordProfile(result.payload.user, "");
    return sendPasswordSession(res, result.payload, profile);
  } catch (error) {
    const message = error?.name === "AbortError" ? "账号服务响应超时，请稍后重试" : "账号服务连接失败，请稍后重试";
    return sendJson(res, error?.name === "AbortError" ? 504 : 502, { error: message });
  }
}

async function handleGuestLogin(req, res) {
  if (getSupabaseConfig()) {
    sendJson(res, 410, { error: "游客登录已关闭，请使用邮箱和密码登录" });
    return;
  }
  const body = await readJsonBody(req);
  const nickname = String(body.nickname || "").trim() || `路人${randomSuffix()}`;
  const user = await createUser({
    nickname,
    avatar_url: "",
    wechat_openid: "",
    login_provider: "guest",
    role: "user",
  });
  const token = signJwt({ sub: user.id, nickname: user.nickname, provider: "guest", role: user.role || "user" });
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
  const user = await fetchUserById(current.sub);
  // 幂等校验：已实名认证的用户不再重复发放经验
  // 同时检查数据库中的 is_verified 和 JWT 中的 verified，防止 fetchUserById 失败时绕过校验
  if (user?.is_verified || current.verified) {
    sendJson(res, 200, { alreadyVerified: true, user: user || { id: current.sub, nickname: current.nickname, is_verified: true }, unlocked: { badge: null, expDelta: 0, levelUp: false } });
    return;
  }
  const oldBadges = user?.badges || ["🌱 新手上路"];
  const newBadges = oldBadges.includes("✅ 实名认证") ? oldBadges : [...oldBadges, "✅ 实名认证"];
  const oldExp = user?.exp || 0;
  const newExp = oldExp + 50;
  const newLevel = calculateLevel(newExp);
  const updated = await updateUser(current.sub, {
    is_verified: true,
    real_name_hash: crypto.createHash("sha256").update(realName + idLast4).digest("hex").slice(0, 16),
    credit_score: 10, // 实名认证后信用分设为10（基准值）
    badges: newBadges,
    exp: newExp,
    level: newLevel,
  });
  const token = signJwt({ sub: updated.id, nickname: updated.nickname, provider: current.provider, verified: true, role: updated.role || "user" });
  sendJson(res, 200, { token, user: updated, unlocked: { badge: "verified", expDelta: 50, levelUp: newLevel > (user?.level || 1) } });
}

async function handleAddExp(req, res) {
  const current = getCurrentUser(req);
  if (!current) {
    sendJson(res, 401, { error: "Not authenticated" });
    return;
  }
  const body = await readJsonBody(req);
  const delta = parseInt(body.delta || 0, 10);
  const action = String(body.action || "").trim();
  // 限制单次经验值增量上限，防止恶意刷级
  if (!delta || delta <= 0 || delta > 1000) {
    sendJson(res, 400, { error: "Invalid delta" });
    return;
  }
  // action 白名单校验
  const ALLOWED_ACTIONS = ["publish", "help", ""];
  if (!ALLOWED_ACTIONS.includes(action)) {
    sendJson(res, 400, { error: "Invalid action" });
    return;
  }
  const updated = await updateUserWithLock(current.sub, (user) => {
    const oldExp = user?.exp || 0;
    const oldLevel = user?.level || 1;
    const newExp = oldExp + delta;
    const newLevel = calculateLevel(newExp);
    const patch = { exp: newExp, level: newLevel };
    if (action === "publish") {
      patch.total_published = (user?.total_published || 0) + 1;
    }
    if (action === "help") {
      patch.total_helped = (user?.total_helped || 0) + 1;
    }
    return patch;
  });
  if (!updated) {
    sendJson(res, 500, { error: "更新失败" });
    return;
  }
  const oldExp = (updated.exp || 0) - delta;
  const oldLevel = calculateLevel(oldExp);
  const newLevel = updated.level || 1;
  sendJson(res, 200, { user: updated, expDelta: delta, levelUp: newLevel > oldLevel, newLevel });
}

async function handleUnlockBadge(req, res) {
  const current = getCurrentUser(req);
  if (!current) {
    sendJson(res, 401, { error: "Not authenticated" });
    return;
  }
  const body = await readJsonBody(req);
  const badgeKey = String(body.badge || "").trim();
  if (!BADGE_DEFS[badgeKey]) {
    sendJson(res, 400, { error: "Unknown badge" });
    return;
  }
  const user = await fetchUserById(current.sub);
  const oldBadges = user?.badges || ["🌱 新手上路"];
  const badgeEmoji = BADGE_DEFS[badgeKey].emoji;
  const badgeLabel = `${badgeEmoji} ${BADGE_DEFS[badgeKey].name}`;
  if (oldBadges.includes(badgeLabel)) {
    sendJson(res, 200, { alreadyHad: true });
    return;
  }
  const newBadges = [...oldBadges, badgeLabel];
  const updated = await updateUser(current.sub, { badges: newBadges });
  sendJson(res, 200, { user: updated, badge: badgeKey, badgeLabel });
}

async function handleCheckStreak(req, res) {
  const current = getCurrentUser(req);
  if (!current) {
    sendJson(res, 401, { error: "Not authenticated" });
    return;
  }
  const user = await fetchUserById(current.sub);
  // 使用北京时间（UTC+8）计算日期，避免凌晨登录时连续签到判断错误
  const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const lastDate = user?.last_active_date || "";
  let streak = user?.streak_days || 0;
  if (lastDate === today) {
    sendJson(res, 200, { streak, today: true });
    return;
  }
  const yesterday = new Date(Date.now() - 86400000 + 8 * 3600 * 1000).toISOString().slice(0, 10);
  if (lastDate === yesterday) {
    streak += 1;
  } else {
    streak = 1;
  }
  const newBadges = user?.badges || ["🌱 新手上路"];
  if (streak >= 7 && !newBadges.includes("🔥 连续活跃")) {
    newBadges.push("🔥 连续活跃");
  }
  const updated = await updateUser(current.sub, { streak_days: streak, last_active_date: today, badges: newBadges });
  sendJson(res, 200, { streak, updated, unlockedStreakBadge: streak >= 7 && !user?.badges?.includes("🔥 连续活跃") });
}

function randomSuffix() {
  return crypto.randomBytes(2).toString("hex");
}

// ============== 数据访问层（Supabase 优先，内存兜底） ==============

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
  const id = fields.id || `user_${crypto.randomBytes(8).toString("hex")}`;
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
    level: 1,
    exp: 0,
    total_published: 0,
    total_helped: 0,
    streak_days: 0,
    last_active_date: "",
    is_institution: false,
    institution_name: "",
    role: fields.role || "user",
    version: 1,
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

// 乐观锁更新：先读取当前 version，PATCH 时带上 version=eq.N 条件，失败则重试一次
async function updateUserWithLock(id, patchMaker, maxRetries = 2) {
  const config = getSupabaseConfig();
  if (!config) {
    const exist = memoryUsers.get(id) || { id };
    const patch = typeof patchMaker === "function" ? patchMaker(exist) : patchMaker;
    const merged = { ...exist, ...patch, version: (exist.version || 1) + 1 };
    memoryUsers.set(id, merged);
    return merged;
  }
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const user = await fetchUserById(id);
    if (!user) return null;
    const currentVersion = user.version || 1;
    const patch = typeof patchMaker === "function" ? patchMaker(user) : patchMaker;
    const body = { ...patch, version: currentVersion + 1 };
    try {
      const response = await supabaseFetch(
        config,
        `/rest/v1/${USERS_TABLE}?id=eq.${encodeURIComponent(id)}&version=eq.${currentVersion}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(body),
        },
      );
      if (response.ok) {
        const rows = await response.json();
        return rows[0] || { id, ...body };
      }
      // 409/404 等乐观锁冲突，继续重试
    } catch (error) {
      // 网络错误，继续重试
    }
  }
  // 重试耗尽，回退到普通更新（保证可用性）
  const user = await fetchUserById(id);
  const patch = typeof patchMaker === "function" ? patchMaker(user || { id }) : patchMaker;
  return updateUser(id, patch);
}

// 导出供其他模块使用
module.exports.fetchUserById = fetchUserById;
module.exports.updateUser = updateUser;
module.exports.updateUserWithLock = updateUserWithLock;
