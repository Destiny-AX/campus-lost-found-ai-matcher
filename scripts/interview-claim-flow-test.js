"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

process.env.LOST_FOUND_JWT_SECRET = "isolated-claim-flow-test-only";

const root = path.resolve(__dirname, "..");
const evidenceDir = path.join(root, "docs", "claim-evidence");
fs.mkdirSync(evidenceDir, { recursive: true });

const tokenUsers = {
  "token-a": { sub: "user-a", nickname: "INTERVIEW_TEST_A", verified: true, role: "user" },
  "token-b": { sub: "user-b", nickname: "INTERVIEW_TEST_B", verified: true, role: "user" },
};

const store = {
  lost_found_records: [],
  shiyun_claim_requests: [],
  shiyun_notifications: [],
  shiyun_resolved_records: [],
  shiyun_credit_logs: [],
  shiyun_users: [
    { id: "user-a", nickname: "INTERVIEW_TEST_A", credit_score: 10, exp: 0, total_helped: 0 },
    { id: "user-b", nickname: "INTERVIEW_TEST_B", credit_score: 10, exp: 0, total_helped: 0 },
  ],
};
const initialCreditLogIds = new Set(store.shiyun_credit_logs.map((row) => row.id));
const initialUserState = new Map(store.shiyun_users.map((row) => [row.id, JSON.parse(JSON.stringify(row))]));


const createdRecordId = "[INTERVIEW_TEST]record-claim-flow";
const statuses = [];
const stateSnapshots = [];

function snapshot(label) {
  stateSnapshots.push({
    label,
    records: store.lost_found_records.filter((row) => row.id === createdRecordId).map((row) => ({ id: row.id, status: row.status, claimed_by: row.claimed_by || null })),
    claim_requests: store.shiyun_claim_requests.filter((row) => row.record_id === createdRecordId).map((row) => ({ id: row.id, status: row.status, claimant_id: row.claimant_id })),
    notifications: store.shiyun_notifications.filter((row) => row.related_record_id === createdRecordId).map((row) => ({ type: row.type, user_id: row.user_id, is_read: Boolean(row.is_read) })),
    resolved: store.shiyun_resolved_records.filter((row) => row.record_id === createdRecordId).map((row) => ({
      finder_confirmed: Boolean(row.finder_confirmed),
      owner_confirmed: Boolean(row.owner_confirmed),
      credit_awarded: Boolean(row.credit_awarded),
    })),
  });
}

function response(status, data) {
  const body = data === undefined ? [] : data;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get() { return null; } },
    async json() { return body; },
    async text() { return JSON.stringify(body); },
  };
}

function parseBody(options) {
  if (!options || options.body === undefined) return {};
  return typeof options.body === "string" ? JSON.parse(options.body) : options.body;
}

function comparable(value) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function filteredRows(tableRows, searchParams) {
  let rows = tableRows;
  for (const [key, raw] of searchParams.entries()) {
    if (["select", "order", "limit", "offset", "or"].includes(key)) continue;
    if (raw.startsWith("eq.")) {
      const expected = raw.slice(3);
      rows = rows.filter((row) => {
        if (expected === "false" && (row[key] === undefined || row[key] === null)) return true;
        return comparable(row[key]) === expected;
      });
    } else if (raw.startsWith("gt.")) {
      const expected = raw.slice(3);
      rows = rows.filter((row) => comparable(row[key]) > expected);
    }
  }
  const limit = Number(searchParams.get("limit") || rows.length);
  return rows.slice(0, limit);
}

async function fakeSupabaseFetch(_config, requestPath, options = {}) {
  const parsed = new URL(requestPath, "http://isolated.test");
  const table = parsed.pathname.replace(/^\/rest\/v1\//, "");
  if (!Object.prototype.hasOwnProperty.call(store, table)) return response(404, { error: "unknown test table" });
  const method = String(options.method || "GET").toUpperCase();
  const tableRows = store[table];
  const matched = filteredRows(tableRows, parsed.searchParams);

  if (method === "GET") return response(200, matched.map((row) => ({ ...row })));
  if (method === "POST") {
    const payload = parseBody(options);
    const inserted = (Array.isArray(payload) ? payload : [payload]).map((row) => ({
      created_at: row.created_at || new Date().toISOString(),
      is_read: row.is_read || false,
      ...(table === "shiyun_resolved_records" ? { credit_awarded: false, owner_confirmed: false } : {}),
      ...row,
    }));
    tableRows.push(...inserted);
    return response(201, inserted.map((row) => ({ ...row })));
  }
  if (method === "PATCH") {
    const patch = parseBody(options);
    matched.forEach((row) => Object.assign(row, patch));
    return response(200, matched.map((row) => ({ ...row })));
  }
  if (method === "DELETE") {
    const matchedSet = new Set(matched);
    for (let index = tableRows.length - 1; index >= 0; index -= 1) {
      if (matchedSet.has(tableRows[index])) tableRows.splice(index, 1);
    }
    return response(200, matched);
  }
  return response(405, { error: "method not supported" });
}

const sharedPath = require.resolve("../api/_shared");
const originalShared = require(sharedPath);
require.cache[sharedPath].exports = {
  ...originalShared,
  getSupabaseConfig: () => ({ url: "http://isolated.test", key: "not-a-real-key" }),
  supabaseFetch: fakeSupabaseFetch,
  readJsonBody: async (req) => req.body || {},
  sendJson: (res, status, payload) => { res.statusCode = status; res.body = payload; },
  getCurrentUser: (req) => {
    const value = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    return tokenUsers[value] || null;
  },
  checkRateLimit: () => ({ ok: true }),
};

const authPath = require.resolve("../api/auth");
require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: { updateUserWithLock: async () => null },
};

delete require.cache[require.resolve("../api/notify")];
const notifyHandler = require("../api/notify");
delete require.cache[require.resolve("../api/records")];
const recordsHandler = require("../api/records");

async function invoke(handler, url, method, token, body) {
  const req = {
    url,
    method,
    body,
    headers: {
      host: "isolated.test",
      authorization: token ? "Bearer " + token : "",
      "x-forwarded-for": "127.0.0.1",
    },
    socket: { remoteAddress: "127.0.0.1" },
  };
  const res = { statusCode: 200, body: null };
  await handler(req, res);
  return { status: res.statusCode, body: res.body };
}

function check(step, condition, evidence = {}) {
  assert.ok(condition, step);
  statuses.push({ step, status: "PASS", ...evidence });
  console.log("PASS | " + step);
}

function loadMatcher() {
  const source = fs.readFileSync(path.join(root, "script.js"), "utf8");
  const sandbox = {
    console,
    document: { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    location: { search: "" },
    TextDecoder, TextEncoder, URL, URLSearchParams, AbortController, FormData, Blob, fetch,
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
    setTimeout, clearTimeout, setInterval, clearInterval,
  };
  vm.createContext(sandbox);
  vm.runInContext(source + "\n;globalThis.__claimMatch = calculateMatch;", sandbox, { filename: "script.js" });
  return sandbox.__claimMatch;
}

function cleanupCreatedData() {
  store.lost_found_records = store.lost_found_records.filter((row) => row.id !== createdRecordId);
  store.shiyun_claim_requests = store.shiyun_claim_requests.filter((row) => row.record_id !== createdRecordId);
  store.shiyun_notifications = store.shiyun_notifications.filter((row) => row.related_record_id !== createdRecordId);
  store.shiyun_resolved_records = store.shiyun_resolved_records.filter((row) => row.record_id !== createdRecordId);
  store.shiyun_credit_logs = store.shiyun_credit_logs.filter((row) => initialCreditLogIds.has(row.id));
  store.shiyun_users = store.shiyun_users.map((row) => {
    const original = initialUserState.get(row.id);
    return original ? JSON.parse(JSON.stringify(original)) : row;
  });
}

async function main() {
  snapshot("before");
  const recordPayload = {
    id: createdRecordId,
    type: "found",
    title: "[INTERVIEW_TEST] 黑色测试双肩包",
    category: "箱包",
    color: "黑色",
    location: "中国传媒大学测试楼三层",
    time: "2026-07-17T10:00",
    contact: "[INTERVIEW_TEST] protected-contact",
    description: "[INTERVIEW_TEST] 正面有方形反光贴，侧袋有蓝色水杯。",
    status: "待认领",
    district: "朝阳区",
    street: "中国传媒大学",
    detail_location: "测试楼三层储物柜旁",
    claim_question: "侧袋物品是什么？",
    semantic: {
      object_name: "黑色双肩包",
      category: "箱包",
      colors: ["黑色", "蓝色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["方形反光贴", "侧袋蓝色水杯"],
      confidence: 0.9,
    },
  };

  const published = await invoke(recordsHandler, "/api/records", "POST", "token-a", { record: recordPayload });
  check("用户 A 发布 [INTERVIEW_TEST] 招领记录", published.status === 200 && published.body.record.id === createdRecordId, { http_status: published.status });
  snapshot("after_publish");

  const visitorList = await invoke(recordsHandler, "/api/records", "GET", "", null);
  const visitorRecord = visitorList.body.records.find((row) => row.id === createdRecordId);
  check("游客联系方式被保护", visitorRecord.contact === "__FUZZY_CONTACT__", { http_status: visitorList.status, contact_exposed: false });
  check("游客精确位置被隐藏", visitorRecord.detail_location === "" && visitorRecord.street === "", { exact_location_exposed: false });

  const beforeApprovalB = await invoke(recordsHandler, "/api/records", "GET", "token-b", null);
  const beforeApprovalRecord = beforeApprovalB.body.records.find((row) => row.id === createdRecordId);
  check("已实名但未通过认领的用户 B 仍无法查看联系方式", beforeApprovalRecord.contact === "__FUZZY_CONTACT__", { contact_exposed: false });

  const query = {
    type: "lost",
    title: "黑色测试双肩包",
    category: "箱包",
    color: "黑色",
    location: "中国传媒大学测试楼",
    time: "2026-07-17T10:10",
    description: "正面有方形反光贴，侧袋有蓝色水杯。",
    semantic: recordPayload.semantic,
  };
  const candidate = { ...published.body.record, location: recordPayload.location, time: recordPayload.time, description: recordPayload.description };
  const matchResult = loadMatcher()(query, candidate);
  check("发布记录可以成为七维匹配候选", matchResult.score >= 75, { score: Math.round(matchResult.score * 100) / 100, coverage: Math.round(matchResult.coverage * 100) / 100 });

  const claim = await invoke(recordsHandler, "/api/records?action=claim-request", "POST", "token-b", { record_id: createdRecordId, answer: "[INTERVIEW_TEST] 蓝色水杯" });
  check("用户 B 发起认领申请", claim.status === 200 && claim.body.ok === true, { http_status: claim.status });
  snapshot("after_claim");

  const ownerNotifications = await invoke(notifyHandler, "/api/notify?action=poll&since=2020-01-01T00:00:00.000Z", "GET", "token-a", null);
  const claimNotification = ownerNotifications.body.notifications.find((item) => item.type === "claim_request" && item.related_record_id === createdRecordId);
  check("用户 A 收到认领通知", Boolean(claimNotification), { http_status: ownerNotifications.status, notification_type: claimNotification && claimNotification.type });
  const claimId = String(claimNotification.body).split("claim_id:")[1];
  assert.ok(claimId);

  const forbiddenReview = await invoke(recordsHandler, "/api/records?action=review-claim", "POST", "token-b", { claim_id: claimId, status: "approved" });
  check("用户 B 不能审核自己的认领申请", forbiddenReview.status === 403, { http_status: forbiddenReview.status });

  const approved = await invoke(recordsHandler, "/api/records?action=review-claim", "POST", "token-a", { claim_id: claimId, status: "approved" });
  check("用户 A 审核通过认领", approved.status === 200 && approved.body.status === "approved", { http_status: approved.status });
  snapshot("after_approval");

  const claimantNotifications = await invoke(notifyHandler, "/api/notify?action=poll&since=2020-01-01T00:00:00.000Z", "GET", "token-b", null);
  const approvedNotice = claimantNotifications.body.notifications.find((item) => item.type === "claim_approved" && item.related_record_id === createdRecordId);
  check("用户 B 收到审核通过通知", Boolean(approvedNotice), { http_status: claimantNotifications.status, notification_type: approvedNotice && approvedNotice.type });

  const afterApprovalB = await invoke(recordsHandler, "/api/records", "GET", "token-b", null);
  const unlockedRecord = afterApprovalB.body.records.find((row) => row.id === createdRecordId);
  check("仅审核通过后的用户 B 解锁联系方式", unlockedRecord.contact !== "__FUZZY_CONTACT__", { contact_unlocked: true, contact_value_recorded: false });

  const returned = await invoke(recordsHandler, "/api/records?action=mark-returned", "POST", "token-a", { record_id: createdRecordId });
  check("用户 A 标记已归还", returned.status === 200 && returned.body.ok === true, { http_status: returned.status });
  snapshot("after_finder_returned");

  const wrongConfirm = await invoke(recordsHandler, "/api/records?action=confirm-received", "POST", "token-a", { record_id: createdRecordId });
  check("发布者不能代替认领者确认收到", wrongConfirm.status === 403, { http_status: wrongConfirm.status });

  const received = await invoke(recordsHandler, "/api/records?action=confirm-received", "POST", "token-b", { record_id: createdRecordId });
  check("用户 B 确认收到并完成归还闭环", received.status === 200 && received.body.ok === true, { http_status: received.status });
  snapshot("after_complete");

  const resolved = await invoke(recordsHandler, "/api/records?action=get-resolved&record_id=" + encodeURIComponent(createdRecordId), "GET", "token-b", null);
  check("找回状态包含双方确认", resolved.status === 200 && resolved.body.resolved.finder_confirmed && resolved.body.resolved.owner_confirmed, { http_status: resolved.status });
  const finalRecord = store.lost_found_records.find((row) => row.id === createdRecordId);
  check("数据库记录状态更新为已找回", finalRecord.status === "已找回", { final_status: finalRecord.status });

  cleanupCreatedData();
  snapshot("after_cleanup");
  check("仅清理本轮 [INTERVIEW_TEST] 数据", !store.lost_found_records.some((row) => row.id === createdRecordId)
    && !store.shiyun_claim_requests.some((row) => row.record_id === createdRecordId)
    && !store.shiyun_notifications.some((row) => row.related_record_id === createdRecordId)
    && !store.shiyun_resolved_records.some((row) => row.record_id === createdRecordId)
    && store.shiyun_credit_logs.every((row) => initialCreditLogIds.has(row.id))
    && store.shiyun_users.every((row) => JSON.stringify(row) === JSON.stringify(initialUserState.get(row.id))), {
      remaining_test_rows: 0,
      credit_logs_restored: true,
      user_state_restored: true,
    });

  const evidence = {
    generated_at: new Date().toISOString(),
    environment: "isolated_in_memory_postgrest_contract_harness",
    production_database_written: false,
    preview_database_written: false,
    limitation: "当前没有隔离的 Preview Supabase 环境变量，因此没有对 Vercel Preview 或生产 Supabase 执行写入。本证据验证真实 API 代码路径与 PostgREST 状态契约，不等同于线上数据库闭环实测。",
    test_prefix: "[INTERVIEW_TEST]",
    statuses,
    state_snapshots: stateSnapshots,
    cleanup: { scoped_to_created_record: true, remaining_test_rows: 0, credit_logs_restored: true, user_state_restored: true },
  };
  fs.writeFileSync(path.join(evidenceDir, "claim-flow-evidence.json"), JSON.stringify(evidence, null, 2) + "\n", "utf8");
  console.log("SUMMARY | passed=" + statuses.length + " failed=0 cleanup_remaining=0 production_writes=0");
}

main().catch((error) => {
  console.error("FAIL | " + (error.stack || error.message));
  process.exitCode = 1;
});
