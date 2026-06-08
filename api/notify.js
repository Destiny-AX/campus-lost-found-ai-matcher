"use strict";

// 站内通知 API（短轮询模式）
// GET  /api/notify?action=poll&since=ISO8601   轮询新通知
// POST /api/notify?action=mark-read             标记已读 { ids: [...] }
// POST /api/notify?action=push                  内部推送（匹配成功等场景）

const {
  getSupabaseConfig,
  supabaseFetch,
  readJsonBody,
  sendJson,
  getCurrentUser,
  safeErrorText,
} = require("./_shared");

const NOTIFICATIONS_TABLE = "shiyun_notifications";

// 内存兜底
const memoryNotifications = [];

module.exports = async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const action = url.searchParams.get("action") || "poll";

    if (action === "poll") return handlePoll(req, res, url);
    if (action === "mark-read") return handleMarkRead(req, res);
    if (action === "push") return handlePush(req, res);

    sendJson(res, 400, { error: "Unknown action" });
  } catch (error) {
    sendJson(res, 500, { error: "Notify API failed", detail: safeErrorText(error.message) });
  }
};

async function handlePoll(req, res, url) {
  const current = getCurrentUser(req);
  const userId = current?.sub;
  const since = url.searchParams.get("since") || new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const config = getSupabaseConfig();
  if (!config) {
    const filtered = memoryNotifications.filter((n) => {
      if (!userId) return false;
      if (n.user_id !== userId) return false;
      return n.created_at > since;
    });
    sendJson(res, 200, { notifications: filtered.slice(-50) });
    return;
  }

  try {
    if (!userId) {
      sendJson(res, 200, { notifications: [] });
      return;
    }
    let query = `/rest/v1/${NOTIFICATIONS_TABLE}?order=created_at.desc&limit=50`;
    query += `&user_id=eq.${encodeURIComponent(userId)}`;
    query += `&created_at=gt.${encodeURIComponent(since)}`;
    const response = await supabaseFetch(config, query, { method: "GET" });
    if (!response.ok) {
      const filtered = memoryNotifications.filter((n) => n.user_id === userId && n.created_at > since);
      sendJson(res, 200, { notifications: filtered.slice(-50), fallback: true });
      return;
    }
    const rows = await response.json();
    sendJson(res, 200, { notifications: rows });
  } catch (error) {
    const filtered = memoryNotifications.filter((n) => n.user_id === userId && n.created_at > since);
    sendJson(res, 200, { notifications: filtered.slice(-50), fallback: true });
  }
}

async function handleMarkRead(req, res) {
  const current = getCurrentUser(req);
  if (!current) {
    sendJson(res, 401, { error: "Not authenticated" });
    return;
  }
  const body = await readJsonBody(req);
  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
  if (!ids.length) {
    sendJson(res, 200, { ok: true });
    return;
  }

  const config = getSupabaseConfig();
  if (!config) {
    memoryNotifications.forEach((n) => {
      if (n.user_id === current.sub && ids.includes(n.id)) n.is_read = true;
    });
    sendJson(res, 200, { ok: true });
    return;
  }

  try {
    const idFilter = ids.map((id) => `id.eq.${encodeURIComponent(id)}`).join(",");
    await supabaseFetch(
      config,
      `/rest/v1/${NOTIFICATIONS_TABLE}?user_id=eq.${encodeURIComponent(current.sub)}&or=(${idFilter})`,
      {
        method: "PATCH",
        body: JSON.stringify({ is_read: true }),
      },
    );
    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 200, { ok: true });
  }
}

async function handlePush(req, res) {
  const current = getCurrentUser(req);
  if (!current) {
    sendJson(res, 401, { error: "Not authenticated" });
    return;
  }
  // 限制：只能向自己推送通知（内部调用使用 pushNotification 导出函数）
  const body = await readJsonBody(req);
  const type = String(body.type || "info").trim();
  const title = String(body.title || "").trim();
  const bodyText = String(body.body || "").trim();
  const relatedRecordId = String(body.related_record_id || "").slice(0, 60).trim();

  if (!title) {
    sendJson(res, 400, { error: "title is required" });
    return;
  }

  const notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    user_id: current.sub,
    type,
    title,
    body: bodyText,
    related_record_id: relatedRecordId,
    is_read: false,
    created_at: new Date().toISOString(),
  };

  const config = getSupabaseConfig();
  if (config) {
    try {
      await supabaseFetch(config, `/rest/v1/${NOTIFICATIONS_TABLE}`, {
        method: "POST",
        body: JSON.stringify(notification),
      });
    } catch (error) {
      // 静默失败，内存兜底
    }
  }
  if (memoryNotifications.length < 500) memoryNotifications.push(notification);
  sendJson(res, 200, { ok: true, notification });
}

// 导出 pushNotification 供其他模块内部调用
module.exports.pushNotification = async function pushNotification({ userId, type, title, body, relatedRecordId }) {
  const notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    user_id: userId || "",
    type: type || "info",
    title: title || "",
    body: body || "",
    related_record_id: relatedRecordId || "",
    is_read: false,
    created_at: new Date().toISOString(),
  };
  const config = getSupabaseConfig();
  if (config) {
    try {
      await supabaseFetch(config, `/rest/v1/${NOTIFICATIONS_TABLE}`, {
        method: "POST",
        body: JSON.stringify(notification),
      });
    } catch (error) {
      // 静默
    }
  }
  if (memoryNotifications.length < 500) memoryNotifications.push(notification);
  return notification;
};
