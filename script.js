"use strict";

// ============================================================
// 拾寻 v2 — 城市拾遗网络 前端核心逻辑
// ============================================================

// ============== 常量与配置 ==============
const WEIGHTS = { category: 0.13, color: 0.08, location: 0.14, time: 0.11, text: 0.14, image: 0.2, semantic: 0.2 };

const colorMap = {
  黑色: [26, 30, 38], 白色: [238, 240, 235], 蓝色: [54, 105, 201],
  红色: [214, 78, 68], 黄色: [232, 175, 50], 绿色: [30, 150, 100],
  银色: [176, 184, 190], 灰色: [140, 140, 140], 粉色: [240, 150, 170], 透明: [202, 224, 229],
};

const categoryRelated = {
  证件: ["学习用品"], 电子设备: ["学习用品", "箱包"], 生活用品: ["钥匙"],
  学习用品: ["证件", "电子设备"], 钥匙: ["生活用品"], 箱包: ["电子设备"], 贵重物品: ["电子设备"], 其他: [],
};

// 城市级地点邻接（扩展版）
const locationGroups = {
  "南京东路": ["人民广场", "外滩"], "人民广场": ["南京东路", "静安寺"],
  "静安寺": ["人民广场", "中山公园"], "中山公园": ["静安寺", "徐家汇"],
  "徐家汇": ["中山公园", "上海南站"], "外滩": ["南京东路", "陆家嘴"],
  "陆家嘴": ["外滩", "世纪大道"], "世纪大道": ["陆家嘴", "张江"],
  "张江": ["世纪大道"], "上海南站": ["徐家汇"], "上海火车站": ["人民广场"],
};

const ITEM_STATUS_LABELS = {
  in_place: "📍 仍在原地", custody: "🤝 代为保管",
  picked: "✅ 已取回", institution: "🏛️ 已交机构", unknown: "❓ 不确定",
};

const AUTH_TOKEN_KEY = "shiyun_auth_token";
const NOTIFY_POLL_INTERVAL = 8000;

// atob() 将 Base64 解码为 Latin-1，中文 UTF-8 多字节会乱码
// 需要先用 atob 拿到字节，再用 TextDecoder 按 UTF-8 解码
function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length < 2) return {};
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const binaryStr = atob(b64);
  const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder("utf-8").decode(bytes));
}

// ============== 全局状态 ==============
let records = [];
let activeFilter = "all";
let uploadedFeature = null;
let uploadedImageData = "";
let uploadedImageUrl = ""; // Supabase Storage URL
let uploadedSemantic = null;
let currentUser = null;
let custodyPoints = [];
let institutions = [];
let notifications = [];
let notifyLastPoll = new Date(0).toISOString();
let notifyTimer = null;

const els = {};

// ============== 启动入口 ==============
document.addEventListener("DOMContentLoaded", async () => {
  cacheElements();
  bindEvents();
  restoreAuth();
  records = await loadRecords();
  custodyPoints = await loadCustodyPoints();
  fillDefaultTime();
  renderAll();
  updateNotifyBadge(0);
  startNotifyPoll();

  // 检查使用说明提示条是否已关闭
  const infoBanner = document.querySelector('#infoBanner');
  if (infoBanner && localStorage.getItem('infoBannerClosed') === 'true') {
    infoBanner.style.display = 'none';
  }
});

// ============== DOM 缓存 ==============
function cacheElements() {
  const ids = [
    "itemList", "searchInput", "categoryFilter", "queryRecord", "selectedRecord",
    "matchResults", "publishForm", "imageInput", "dropZone", "imagePreview",
    "featurePreview", "metricGrid", "topAlerts", "detailDialog", "detailContent",
    "closeDialog", "topAuthBtn", "topVerifyBtn", "mobileAuthBtn",
    "loginDialog", "loginForm", "loginGuestBtn", "closeLoginBtn",
    "verifyDialog", "verifyForm", "closeVerifyBtn",
    "pickupDialog", "pickupForm", "closePickupBtn",
    "aiInput", "aiExtractBtn", "aiExtractHint",
    "itemStatusGroup", "custodyPicker", "custodyPointSelect",
    "notifyList", "markAllReadBtn", "notifyBadge", "notifyBadgeMobile",
    "profileContent", "toastHost",
  ];
  ids.forEach((id) => { els[toCamel(id)] = document.querySelector(`#${id}`); });
  els.submitButton = els.publishForm?.querySelector(".submit-button");
}

function toCamel(str) { return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }

// ============== 事件绑定 ==============
// 安全事件绑定：元素不存在时跳过，不中断后续绑定
function on(el, event, handler) { if (el) el.addEventListener(event, handler); }

function bindEvents() {
  // 视图切换
  document.querySelectorAll("[data-view-target]").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.viewTarget));
  });

  // 筛选
  document.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((c) => c.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderItemList();
    });
  });

  on(els.searchInput, "input", renderItemList);
  on(els.categoryFilter, "change", renderItemList);
  on(els.queryRecord, "change", renderMatchView);
  on(els.imageInput, "change", handleImageUpload);
  bindDropUpload();
  on(els.publishForm, "submit", handlePublish);
  on(els.closeDialog, "click", () => els.detailDialog?.close());

  // 登录按钮事件在 updateAuthUI 中动态绑定
  on(els.closeLoginBtn, "click", () => els.loginDialog?.close());
  on(els.loginForm, "submit", handleWechatLogin);
  on(els.loginGuestBtn, "click", handleGuestLogin);

  // 实名认证
  on(els.topVerifyBtn, "click", () => els.verifyDialog?.showModal());
  on(els.closeVerifyBtn, "click", () => els.verifyDialog?.close());
  on(els.verifyForm, "submit", handleVerifyIdentity);

  // 用户信息弹窗
  document.querySelector("#closeUserBtn")?.addEventListener("click", () => document.querySelector("#userDialog")?.close());
  document.querySelector("#userDialogLogoutBtn")?.addEventListener("click", () => {
    document.querySelector("#userDialog")?.close();
    handleLogout();
  });
  document.querySelector("#userDialogVerifyBtn")?.addEventListener("click", () => {
    document.querySelector("#userDialog")?.close();
    els.verifyDialog?.showModal();
  });

  // 取件
  on(els.closePickupBtn, "click", () => els.pickupDialog?.close());
  on(els.pickupForm, "submit", handlePickup);

  // AI 结构化输入
  on(els.aiExtractBtn, "click", handleAiExtract);

  // 物品状态切换
  els.publishForm?.querySelectorAll('input[name="type"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      const isFound = radio.value === "found";
      if (els.itemStatusGroup) els.itemStatusGroup.hidden = !isFound;
    });
  });
  els.publishForm?.querySelectorAll('input[name="item_status"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (els.custodyPicker) els.custodyPicker.hidden = radio.value !== "custody";
    });
  });

  // 通知
  on(els.markAllReadBtn, "click", handleMarkAllRead);

  // 使用说明提示条关闭
  const closeInfoBannerBtn = document.querySelector('#closeInfoBanner');
  if (closeInfoBannerBtn) {
    closeInfoBannerBtn.addEventListener('click', () => {
      const banner = document.querySelector('#infoBanner');
      if (banner) {
        banner.style.display = 'none';
        localStorage.setItem('infoBannerClosed', 'true');
      }
    });
  }
}

function bindDropUpload() {
  ["dragenter", "dragover"].forEach((e) => {
    els.dropZone.addEventListener(e, (ev) => { ev.preventDefault(); els.dropZone.classList.add("is-dragging"); });
  });
  ["dragleave", "drop"].forEach((e) => {
    els.dropZone.addEventListener(e, (ev) => { ev.preventDefault(); els.dropZone.classList.remove("is-dragging"); });
  });
  els.dropZone.addEventListener("drop", (ev) => {
    const file = [...ev.dataTransfer.files].find((f) => f.type.startsWith("image/"));
    if (!file) { renderUploadMessage("请拖入图片文件。"); return; }
    processUploadedImage(file);
  });
}

// ============== 视图切换 ==============
function switchView(view) {
  document.querySelectorAll(".view").forEach((s) => s.classList.remove("is-active"));
  document.querySelector(`#view-${view}`)?.classList.add("is-active");
  document.querySelectorAll("[data-view-target]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.viewTarget === view);
  });
  if (view === "match") renderMatchView();
  if (view === "stats") renderStats();
  if (view === "profile") renderProfile();
  if (view === "notify") renderNotifyList();
}

// ============== 鉴权 ==============
function restoreAuth() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return;
  try {
    const payload = decodeJwtPayload(token);
    if (payload.exp && Date.now() / 1000 > payload.exp) { localStorage.removeItem(AUTH_TOKEN_KEY); return; }
    currentUser = payload;
    updateAuthUI();
  } catch (e) { localStorage.removeItem(AUTH_TOKEN_KEY); }
}

function updateAuthUI() {
  const loggedIn = !!currentUser;
  if (loggedIn) {
    els.topAuthBtn.textContent = currentUser.nickname || "已登录";
    els.topAuthBtn.classList.add("is-logged-in");
    els.topAuthBtn.onclick = () => openUserDialog();
    els.mobileAuthBtn.textContent = currentUser.nickname || "已登录";
    els.mobileAuthBtn.onclick = () => openUserDialog();
  } else {
    els.topAuthBtn.textContent = "微信登录";
    els.topAuthBtn.classList.remove("is-logged-in");
    els.topAuthBtn.onclick = () => els.loginDialog?.showModal();
    els.mobileAuthBtn.textContent = "登录";
    els.mobileAuthBtn.onclick = () => els.loginDialog?.showModal();
  }
  els.topVerifyBtn.hidden = !(loggedIn && !currentUser.verified);
}

function openUserDialog() {
  if (!currentUser) return;
  const avatar = document.querySelector("#userDialogAvatar");
  const nickname = document.querySelector("#userDialogNickname");
  const status = document.querySelector("#userDialogStatus");
  const info = document.querySelector("#userDialogInfo");
  const verifyBtn = document.querySelector("#userDialogVerifyBtn");

  if (avatar) avatar.textContent = (currentUser.nickname || "?")[0];
  if (nickname) nickname.textContent = currentUser.nickname || "无名氏";
  if (status) status.textContent = currentUser.verified ? "✅ 已实名认证" : "⚠️ 未实名认证";
  if (verifyBtn) verifyBtn.style.display = currentUser.verified ? "none" : "block";
  if (info) {
    info.innerHTML = `
      <p style="font-size:13px;color:var(--text2);margin:4px 0;">登录方式：${currentUser.provider === "wechat_mock" ? "微信" : "游客"}</p>
      <p style="font-size:13px;color:var(--text2);margin:4px 0;">信用积分：${currentUser.verified ? 10 : 5}</p>
    `;
  }

  document.querySelector("#userDialog").showModal();
}

function authHeaders() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleWechatLogin(event) {
  event.preventDefault();
  const form = new FormData(els.loginForm);
  const data = Object.fromEntries(form.entries());
  try {
    const response = await fetch("/api/auth?action=wechat-login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const payload = await response.json();
    if (!response.ok) { showToast(payload.error || "登录失败", "error"); return; }
    localStorage.setItem(AUTH_TOKEN_KEY, payload.token);
    currentUser = decodeJwtPayload(payload.token);
    updateAuthUI();
    els.loginDialog.close();
    showToast(`欢迎，${currentUser.nickname}！`, "success");
    setTimeout(() => window.location.reload(), 300);
  } catch (e) { showToast("网络错误", "error"); }
}

async function handleGuestLogin() {
  try {
    const response = await fetch("/api/auth?action=guest-login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    });
    const payload = await response.json();
    if (!response.ok) { showToast(payload.error || "登录失败", "error"); return; }
    localStorage.setItem(AUTH_TOKEN_KEY, payload.token);
    currentUser = decodeJwtPayload(payload.token);
    updateAuthUI();
    els.loginDialog.close();
    showToast(`游客 ${currentUser.nickname}，欢迎体验！`, "success");
    setTimeout(() => window.location.reload(), 300);
  } catch (e) { showToast("网络错误", "error"); }
}

async function handleVerifyIdentity(event) {
  event.preventDefault();
  const form = new FormData(els.verifyForm);
  const data = Object.fromEntries(form.entries());
  try {
    const response = await fetch("/api/auth?action=verify-identity", {
      method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    const payload = await response.json();
    if (!response.ok) { showToast(payload.error || "认证失败", "error"); return; }
    localStorage.setItem(AUTH_TOKEN_KEY, payload.token);
    currentUser = decodeJwtPayload(payload.token);
    updateAuthUI();
    els.verifyDialog.close();
    showToast("实名认证成功！现在可以查看完整信息。", "success");
    setTimeout(() => window.location.reload(), 300);
  } catch (e) { showToast("网络错误", "error"); }
}

// ============== AI 结构化输入 ==============
let aiExtractDebounce = null;
async function handleAiExtract() {
  const text = els.aiInput.value.trim();
  if (!text) { showToast("请先输入描述文字", "error"); return; }
  if (aiExtractDebounce) return;
  aiExtractDebounce = true;
  els.aiExtractBtn.disabled = true;
  els.aiExtractBtn.querySelector(".ai-extract-text").textContent = "AI 正在分析...";
  try {
    const response = await fetch("/api/structured-input", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.structured) { showToast("AI 分析失败，请手动填写", "error"); return; }
    const s = payload.structured;
    fillFormFields(s);
    if (s.title && (s.title.length > 15 || /^(?:在|丢了|捡到|一个)/.test(s.title))) {
      showToast(`AI 已自动填表，但 title "${s.title}" 可能需要手动修正`, "warning");
    } else {
      showToast(`AI 已自动填表（置信度 ${Math.round(s.confidence * 100)}%，来源：${payload.source}）`, "success");
    }
  } catch (e) {
    showToast("网络错误，请手动填写", "error");
  } finally {
    aiExtractDebounce = null;
    els.aiExtractBtn.disabled = false;
    els.aiExtractBtn.querySelector(".ai-extract-text").textContent = "让 AI 自动填表";
  }
}

function fillFormFields(s) {
  const form = els.publishForm;
  if (s.type) {
    const typeLabel = form.querySelector(`.form-row.segmented label:has(input[name="type"][value="${s.type}"])`);
    if (typeLabel) typeLabel.click();
  }
  const titleInput = form.querySelector('input[name="title"]');
  if (titleInput && s.title) titleInput.value = s.title;
  const categorySelect = form.querySelector('select[name="category"]');
  if (categorySelect && s.category) setSelectValue(categorySelect, s.category);
  const colorSelect = form.querySelector('select[name="color"]');
  if (colorSelect && s.color) setSelectValue(colorSelect, s.color);
  const locationInput = form.querySelector('input[name="location"]');
  if (locationInput && s.location) locationInput.value = s.location;
  const timeInput = form.querySelector('input[name="time"]');
  if (timeInput && s.time) timeInput.value = s.time;
  const descTextarea = form.querySelector('textarea[name="description"]');
  if (descTextarea && s.description) descTextarea.value = s.description;
  if (s.type === "found") els.itemStatusGroup.hidden = false;
  if (s.item_status) {
    const statusLabel = form.querySelector(`.status-option:has(input[name="item_status"][value="${s.item_status}"])`);
    if (statusLabel) statusLabel.click();
    els.custodyPicker.hidden = s.item_status !== "custody";
  }
}

function setSelectValue(select, value) {
  const opt = [...select.options].find((o) => o.value === value);
  if (opt) select.value = value;
}

// ============== 数据加载 ==============
async function loadRecords() {
  try {
    const remoteRecords = await fetchPersistedRecords();
    return remoteRecords;
  } catch (e) {
    console.error("loadRecords 失败:", e);
    return [];
  }
}

async function hydrateRecord(record) {
  try {
    // 远程记录可能没有 visualSeed，提供默认值
    const defaultSeed = { background: "#e8ecf0", primary: "#6b7280", secondary: "#9ca3af", shape: "card" };
    const seed = record.visualSeed || defaultSeed;
    const imageData = record.imageData || createSyntheticImage(seed, record.title);
    const imageFeature = record.imageFeature || (imageData ? (await extractImageFeatures(imageData)) : null);
    return { ...record, imageData, imageFeature, semantic: record.semantic || buildFallbackSemantic(record) };
  } catch (e) {
    console.error("hydrateRecord 失败:", record.id, e);
    return { ...record, imageData: record.imageData || "", imageFeature: null, semantic: record.semantic || buildFallbackSemantic(record) };
  }
}

async function fetchPersistedRecords() {
  try {
    const response = await fetch("/api/records", { headers: authHeaders() });
    if (!response.ok) return [];
    const payload = await response.json();
    const list = Array.isArray(payload.records) ? payload.records.filter(Boolean) : [];
    return Promise.all(list.map(hydrateRecord));
  } catch (e) { return []; }
}

async function loadCustodyPoints() {
  try {
    const pointsResponse = await fetch("/api/custody?action=points");
    if (pointsResponse.ok) {
      const pointsPayload = await pointsResponse.json();
      custodyPoints = pointsPayload.points || [];
    }

    const instResponse = await fetch("/api/custody?action=institutions");
    if (instResponse.ok) {
      const instPayload = await instResponse.json();
      institutions = instPayload.institutions || [];
    }

    return custodyPoints;
  } catch (e) { return []; }
}

// ============== 渲染 ==============
function renderAll() {
  renderItemList();
  renderQueryOptions();
  renderMatchView();
  renderStats();
  renderTopAlerts();
  renderCustodyOptions();
}

function renderItemList() {
  const query = normalizeText(els.searchInput.value);
  const category = els.categoryFilter.value;
  let list = records.slice().sort((a, b) => new Date(b.time) - new Date(a.time));
  list = list.filter((r) => {
    const haystack = normalizeText(`${r.title}${r.category}${r.color}${r.location}${r.description}`);
    const matchesSearch = !query || haystack.includes(query);
    const matchesCategory = category === "all" || r.category === category;
    const matchesType = activeFilter === "all" || r.type === activeFilter ||
      (activeFilter === "hot" && getBestMatch(r).score >= 75) ||
      (activeFilter === "institution" && r.item_status === "institution");
    return matchesSearch && matchesCategory && matchesType;
  });
  els.itemList.innerHTML = list.length
    ? list.map((r) => renderRecordCard(r)).join("")
    : `<div class="empty-state">没有找到符合条件的信息。</div>`;
  bindCardActions();
}

function renderRecordCard(record) {
  const best = getBestMatch(record);
  const isOwn = isOwnRecord(record);
  const fuzzy = record.is_fuzzy;
  const statusLabel = ITEM_STATUS_LABELS[record.item_status] || "";
  const institutionBadge = record.item_status === "institution" ? `<span class="meta-pill institution-pill">🏛️ 官方</span>` : "";
  const custodyBadge = record.item_status === "custody" ? `<span class="meta-pill custody-pill">🤝 代保管</span>` : "";
  const fuzzyBadge = fuzzy ? `<span class="meta-pill fuzzy-pill">🔒 模糊化</span>` : "";
  const ownActions = isOwn ? `<button class="ghost-button" data-edit-id="${record.id}" type="button">编辑</button><button class="danger-button" data-delete-id="${record.id}" type="button">删除</button>` : "";
  const defaultSeed = { background: "#e8ecf0", primary: "#6b7280", secondary: "#9ca3af", shape: "card" };
  const imgSrc = record.imageData || createSyntheticImage(record.visualSeed || defaultSeed, record.title);
  return `
    <article class="card${fuzzy ? " is-fuzzy" : ""}">
      <span class="thumb">
        <img src="${imgSrc}" alt="${escapeHtml(record.title)}" ${fuzzy ? 'style="filter:blur(8px)"' : ""} />
        <span class="badge-row">
          <span class="status-badge ${record.type}">${record.type === "lost" ? "寻物" : "招领"}</span>
          <span class="match-badge">匹配 ${Math.round(best.score)}%</span>
        </span>
      </span>
      <div class="card-body">
        <h4>${escapeHtml(record.title)}</h4>
        <div class="meta-line">
          <span class="meta-pill">${escapeHtml(record.category)}</span>
          <span class="meta-pill">${escapeHtml(record.color)}</span>
          <span class="meta-pill">${escapeHtml(record.location)}</span>
          ${institutionBadge}${custodyBadge}${fuzzyBadge}
        </div>
        <p>${escapeHtml(record.description)}</p>
        <div class="meta-line">${formatTime(record.time)} · ${escapeHtml(record.status)}${statusLabel ? " · " + statusLabel : ""}</div>
        <div class="card-actions">
          <button class="ghost-button" data-detail-id="${record.id}" type="button">详情</button>
          <button class="ghost-button" data-match-id="${record.id}" type="button">匹配</button>
          ${record.item_status === "custody" && record.type === "found" ? `<button class="ghost-button pickup-btn" data-pickup-id="${record.id}" type="button">取件</button>` : ""}
          ${ownActions}
        </div>
      </div>
    </article>`;
}

function bindCardActions(container = els.itemList) {
  container.querySelectorAll("[data-detail-id]").forEach((btn) => {
    btn.addEventListener("click", () => openDetail(btn.dataset.detailId));
  });
  container.querySelectorAll("[data-match-id]").forEach((btn) => {
    btn.addEventListener("click", () => { els.queryRecord.value = btn.dataset.matchId; switchView("match"); });
  });
  container.querySelectorAll("[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", () => openEditForm(btn.dataset.editId));
  });
  container.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () => deleteRecord(btn.dataset.deleteId));
  });
  container.querySelectorAll("[data-pickup-id]").forEach((btn) => {
    btn.addEventListener("click", () => { els.pickupForm.querySelector('input[name="record_id"]')?.remove(); const hidden = document.createElement("input"); hidden.type = "hidden"; hidden.name = "record_id"; hidden.value = btn.dataset.pickupId; els.pickupForm.appendChild(hidden); els.pickupDialog.showModal(); });
  });
}

function renderQueryOptions() {
  els.queryRecord.innerHTML = records
    .map((r) => `<option value="${r.id}">${r.type === "lost" ? "寻物" : "招领"}｜${escapeHtml(r.title)}</option>`)
    .join("");
}

function renderMatchView() {
  if (!records.length) return;
  const queryId = els.queryRecord.value || records[0].id;
  const queryRecord = records.find((r) => r.id === queryId) || records[0];
  els.queryRecord.value = queryRecord.id;
  els.selectedRecord.innerHTML = renderMiniRecord(queryRecord);
  const matches = getMatchesFor(queryRecord).slice(0, 5);
  els.matchResults.innerHTML = matches.length
    ? matches.map((m) => renderMatchItem(m.record, m.result)).join("")
    : `<div class="empty-state">当前没有相反类型的信息可匹配。</div>`;
  els.matchResults.querySelectorAll("[data-detail-id]").forEach((btn) => {
    btn.addEventListener("click", () => openDetail(btn.dataset.detailId));
  });
  els.matchResults.querySelectorAll("[data-contact-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const record = records.find((r) => r.id === btn.dataset.contactId);
      if (record) showMatchContact(record);
    });
  });
}

function showMatchContact(record) {
  if (!currentUser) {
    showToast("请先登录", "info");
    els.loginDialog.showModal();
    return;
  }
  if (!currentUser.verified) {
    showToast("请先完成实名认证以查看联系方式", "info");
    setTimeout(() => els.verifyDialog.showModal(), 500);
    return;
  }
  const contact = record.is_fuzzy ? "信息已模糊化" : escapeHtml(record.contact);
  showToast(`联系方式：${contact}`, "success");
}

function renderMiniRecord(record) {
  return `<div class="mini-record">
    <img src="${record.imageData}" alt="${escapeHtml(record.title)}" />
    <div><strong>${escapeHtml(record.title)}</strong>
    <div class="meta-line">${record.type === "lost" ? "寻物" : "招领"} · ${escapeHtml(record.category)} · ${escapeHtml(record.color)}</div>
    <div class="meta-line">${escapeHtml(record.location)} · ${formatTime(record.time)}</div></div>
  </div>`;
}

function renderMatchItem(record, result) {
  const parts = result.breakdown;
  return `<article class="match-item">
    <img src="${record.imageData}" alt="${escapeHtml(record.title)}" />
    <div>
      <div class="meta-line"><span class="status-badge ${record.type}">${record.type === "lost" ? "寻物" : "招领"}</span><span class="alert-score">${Math.round(result.score)}%</span></div>
      <h4>${escapeHtml(record.title)}</h4>
      <div class="score-bar"><div class="score-fill" style="width:${Math.round(result.score)}%"></div></div>
      <div class="score-breakdown">
        <span>类别 ${Math.round(parts.category)}%</span><span>颜色 ${Math.round(parts.color)}%</span>
        <span>地点 ${Math.round(parts.location)}%</span><span>时间 ${Math.round(parts.time)}%</span>
        <span>文本 ${Math.round(parts.text)}%</span><span>图像 ${Math.round(parts.image)}%</span>
        <span>语义 ${Math.round(parts.semantic)}%</span>
      </div>
      <ul class="reason-list">${result.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
      <div class="card-actions">
        <button class="ghost-button" data-detail-id="${record.id}" type="button">查看详情</button>
        ${currentUser?.verified ? `<button class="ghost-button" data-contact-id="${record.id}" type="button">联系对方</button>` : `<button class="ghost-button" type="button" disabled>实名后联系</button>`}
      </div>
    </div>
  </article>`;
}

function renderStats() {
  const total = records.length;
  const today = records.filter((r) => isToday(r.time)).length;
  const strong = records.filter((r) => getBestMatch(r).score >= 80).length;
  const withSemantic = records.filter((r) => r.semantic).length;
  const metrics = [["发布总数", total], ["今日新增", today], ["高匹配线索", strong], ["语义识别记录", withSemantic]];
  els.metricGrid.innerHTML = metrics
    .map(([label, value]) => `<div class="metric-card"><strong>${label}</strong><span>${value}</span></div>`).join("");
}

function renderTopAlerts() {
  const alerts = records
    .flatMap((r) => getMatchesFor(r).slice(0, 1).map((m) => ({ source: r, ...m })))
    .sort((a, b) => b.result.score - a.result.score).slice(0, 3);
  els.topAlerts.innerHTML = alerts.map((a) => `
    <div class="alert-item">
      <strong>${escapeHtml(a.source.title)} ↔ ${escapeHtml(a.record.title)}</strong>
      <span class="alert-score">${Math.round(a.result.score)}%</span>
      <p>${escapeHtml(a.result.reasons.slice(0, 2).join("，"))}</p>
    </div>`).join("");
}

function renderCustodyOptions() {
  if (!custodyPoints.length) return;
  const select = els.custodyPointSelect;
  select.innerHTML = `<option value="">不寄存，等失主联系</option>` +
    custodyPoints.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}（${p.type === "locker" ? "智能柜" : p.type === "convenience_store" ? "便利店" : "物业"}）${escapeHtml(p.operating_hours || "")}</option>`).join("");
}

// ============== 详情弹窗 ==============
function openDetail(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  const matches = getMatchesFor(record).slice(0, 3);
  const isOwn = isOwnRecord(record);
  const fuzzy = record.is_fuzzy;
  const statusLabel = ITEM_STATUS_LABELS[record.item_status] || "";
  const ownActions = isOwn ? `<button class="danger-button" data-delete-id="${record.id}" type="button">删除这条发布</button>` : "";

  const verifyPrompt = fuzzy
    ? `<div class="fuzzy-notice">🔒 部分信息已模糊化处理，<button class="text-button verify-trigger" type="button">完成实名认证</button>后可查看完整信息。</div>`
    : "";

  let contactDisplay;
  if (fuzzy) {
    contactDisplay = `<button class="primary-action view-contact-btn" data-record-id="${record.id}" type="button">🔒 查看联系方式</button>`;
  } else {
    contactDisplay = `<span class="contact-info">${escapeHtml(record.contact)}</span>`;
  }

  let custodyInfo = "";
  if (record.item_status === "custody" && record.custody_point_id) {
    const point = custodyPoints.find((p) => p.id === record.custody_point_id);
    if (point) {
      custodyInfo = `<div class="custody-info">
        <p><strong>代保管点：</strong>${escapeHtml(point.name)}</p>
        <p><strong>地址：</strong>${escapeHtml(point.address)}</p>
        <p><strong>营业时间：</strong>${escapeHtml(point.operating_hours)}</p>
      </div>`;
    }
  }

  let institutionInfo = "";
  if (record.item_status === "institution") {
    institutionInfo = renderInstitutionContact(record);
  }

  const pickupInfo = isOwn && record.pickup_code
    ? `<div class="pickup-code-display"><strong>取件码：</strong><code>${record.pickup_code}</code><small>请将取件码后半部分告知失主</small></div>`
    : "";

  els.detailContent.innerHTML = `
    <div class="detail-content">
      <img src="${record.imageData}" alt="${escapeHtml(record.title)}" ${fuzzy ? 'style="filter:blur(8px)"' : ""} />
      <div class="detail-body">
        <div><span class="status-badge ${record.type}">${record.type === "lost" ? "寻物" : "招领"}</span><h3>${escapeHtml(record.title)}</h3></div>
        <div class="meta-line">
          <span class="meta-pill">${escapeHtml(record.category)}</span><span class="meta-pill">${escapeHtml(record.color)}</span>
          <span class="meta-pill">${escapeHtml(record.location)}</span><span class="meta-pill">${formatTime(record.time)}</span>
          ${record.item_status !== "unknown" ? `<span class="meta-pill">${statusLabel}</span>` : ""}
        </div>
        ${verifyPrompt}
        <p>${escapeHtml(record.description)}</p>
        <div class="contact-section">
          <strong>联系方式：</strong>
          ${contactDisplay}
        </div>
        ${custodyInfo}${institutionInfo}${pickupInfo}
        ${ownActions ? `<div class="card-actions">${ownActions}</div>` : ""}
        ${renderSemanticBlock(record.semantic)}
        <div><strong>相似线索</strong><ul class="reason-list">${
          matches.length ? matches.map((m) => `<li>${escapeHtml(m.record.title)}：${Math.round(m.result.score)}%，${escapeHtml(m.result.reasons[0] || "存在相似特征")}</li>`).join("") : "<li>暂无候选匹配项</li>"
        }</ul></div>
      </div>
    </div>`;

  if (typeof els.detailDialog.showModal === "function") els.detailDialog.showModal();

  els.detailContent.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () => deleteRecord(btn.dataset.deleteId));
  });
  els.detailContent.querySelectorAll(".verify-trigger").forEach((btn) => {
    btn.addEventListener("click", () => { els.detailDialog.close(); els.verifyDialog.showModal(); });
  });
  els.detailContent.querySelectorAll(".view-contact-btn").forEach((btn) => {
    btn.addEventListener("click", () => showContactPrompt());
  });
}

function showContactPrompt() {
  showToast("请先完成实名认证以查看联系方式", "info");
  setTimeout(() => {
    els.verifyDialog.showModal();
  }, 500);
}

function renderInstitutionContact(record) {
  const contactText = record.contact || "";
  const descText = record.description || "";
  const isInstitution = record.item_status === "institution";

  for (const inst of institutions) {
    if (contactText.includes(inst.name) || descText.includes(inst.name) ||
        record.location?.includes(inst.name)) {
      return `<div class="institution-info">
        <p><strong>保管机构：</strong>${escapeHtml(inst.name)} ${inst.verified ? '<span class="verified-badge">✓ 官方认证</span>' : ''}</p>
        <p><strong>联系电话：</strong><a href="tel:${inst.contact}">${inst.contact}</a></p>
        <p><strong>地址：</strong>${escapeHtml(inst.address)}</p>
      </div>`;
    }
  }

  if (record.contact && (!record.is_fuzzy || isInstitution)) {
    return `<div class="institution-info">
      <p><strong>保管方联系方式：</strong><a href="tel:${record.contact}">${escapeHtml(record.contact)}</a></p>
    </div>`;
  }

  if (record.is_fuzzy && !isInstitution) {
    return `<div class="institution-info fuzzy">
      <p><strong>保管机构：</strong>实名认证后查看</p>
      <p><strong>联系电话：</strong><button class="text-button verify-trigger" type="button">完成实名认证后查看</button></p>
    </div>`;
  }

  return "";
}

function renderSemanticBlock(semantic) {
  if (!semantic) return "";
  return `<div><strong>视觉语义标签</strong>
    <p>${escapeHtml(semantic.object_name)} · ${escapeHtml(semantic.category)} · 置信度 ${Math.round(semantic.confidence * 100)}%</p>
    <p>特征：${escapeHtml(semantic.features.join("、") || "暂无")}</p></div>`;
}

// ============== 消息中心 ==============
function renderNotifyList() {
  if (!notifications.length) {
    els.notifyList.innerHTML = `<div class="empty-state">暂无消息，发布信息后系统会自动推送匹配线索。</div>`;
    return;
  }
  els.notifyList.innerHTML = notifications.map((n) => `
    <div class="notify-item${n.is_read ? " is-read" : ""}">
      <div class="notify-title">${escapeHtml(n.title)}</div>
      <div class="notify-body">${escapeHtml(n.body || "")}</div>
      <div class="notify-time">${formatTime(n.created_at)}</div>
    </div>`).join("");
}

function startNotifyPoll() {
  if (notifyTimer) clearInterval(notifyTimer);
  pollNotifications();
  notifyTimer = setInterval(pollNotifications, NOTIFY_POLL_INTERVAL);
}

async function pollNotifications() {
  if (!currentUser) {
    updateNotifyBadge(0);
    return;
  }
  try {
    const response = await fetch(`/api/notify?action=poll&since=${encodeURIComponent(notifyLastPoll)}`, { headers: authHeaders() });
    if (!response.ok) {
      updateNotifyBadge(0);
      return;
    }
    const payload = await response.json();
    const newNotifs = payload.notifications || [];
    if (newNotifs.length) {
      const unread = newNotifs.filter((n) => !n.is_read);
      notifications = [...newNotifs, ...notifications].slice(0, 100);
      notifyLastPoll = newNotifs[0]?.created_at || notifyLastPoll;
      updateNotifyBadge(unread.length);
      if (unread.length) showToast(`${unread.length} 条新消息`, "info");
    } else {
      const existingUnread = notifications.filter((n) => !n.is_read).length;
      updateNotifyBadge(existingUnread);
    }
  } catch (e) { 
    updateNotifyBadge(0);
  }
}

function updateNotifyBadge(count) {
  const show = count > 0;
  els.notifyBadge.hidden = !show;
  els.notifyBadgeMobile.hidden = !show;
  if (show) { 
    els.notifyBadge.textContent = count > 9 ? "9+" : count; 
    els.notifyBadgeMobile.textContent = count > 9 ? "9+" : count; 
  } else {
    els.notifyBadge.textContent = "";
    els.notifyBadgeMobile.textContent = "";
  }
}

async function handleMarkAllRead() {
  const ids = notifications.filter((n) => !n.is_read).map((n) => n.id);
  if (!ids.length) return;
  try {
    await fetch("/api/notify?action=mark-read", {
      method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ ids }),
    });
    notifications.forEach((n) => { n.is_read = true; });
    updateNotifyBadge(0);
    renderNotifyList();
  } catch (e) { /* 静默 */ }
}

// ============== 个人主页 ==============
function renderProfile() {
  if (!currentUser) {
    els.profileContent.innerHTML = `<div class="empty-state">请先登录查看个人信息。<button class="primary-action" onclick="document.querySelector('#loginDialog').showModal()">微信登录</button></div>`;
    return;
  }
  const verified = currentUser.verified;
  const badges = verified ? ["✅ 实名认证用户"] : ["🌱 新手上路"];
  const creditScore = verified ? 10 : 5;

  const verifySection = verified
    ? `<div class="verify-status verified"><span>✅ 已完成实名认证</span><small>您可以查看完整联系方式</small></div>`
    : `<div class="verify-status unverified"><span>⚠️ 未实名认证</span><small>认证后可查看完整联系方式</small></div>
       <button class="primary-action" onclick="document.querySelector('#verifyDialog').showModal()">完成实名认证</button>`;

  const myRecords = records.filter((r) => r.owner_id === currentUser.sub);
  const myRecordsHtml = myRecords.length
    ? `<div class="my-records-list">${myRecords.map((r) => renderRecordCard(r)).join("")}</div>`
    : `<div class="empty-state"><p>暂无发布记录</p><button class="primary-action" onclick="switchView('publish')">去发布一条</button></div>`;

  els.profileContent.innerHTML = `
    <div class="profile-card">
      <div class="profile-avatar">${escapeHtml((currentUser.nickname || "?")[0])}</div>
      <div class="profile-info">
        <h3>${escapeHtml(currentUser.nickname || "无名氏")}</h3>
        <p>${verified ? "✅ 已实名认证" : "⚠️ 未实名认证"}</p>
        <p>登录方式：${currentUser.provider === "wechat_mock" ? "微信" : "游客"}</p>
      </div>
    </div>
    <div class="profile-stats">
      <div class="metric-card"><strong>信用积分</strong><span>${creditScore}</span></div>
      <div class="metric-card"><strong>发布数</strong><span>${myRecords.length}</span></div>
      <div class="metric-card"><strong>徽章</strong><span>${badges.length}</span></div>
    </div>
    <div class="profile-badges">
      <h4>我的徽章</h4>
      <div class="badge-list">${badges.map((b) => `<span class="badge-item">${b}</span>`).join("")}</div>
    </div>
    ${verifySection}
    <div class="my-records-section">
      <h4>我发布的记录</h4>
      ${myRecordsHtml}
    </div>
    <button class="text-button" id="logoutBtn" type="button">退出登录</button>`;
  document.querySelector("#logoutBtn")?.addEventListener("click", handleLogout);

  // 绑定我的记录列表中的卡片操作
  const myRecordsList = els.profileContent.querySelector(".my-records-list");
  if (myRecordsList) bindCardActions(myRecordsList);
}

function handleLogout() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  currentUser = null;
  updateAuthUI();
  showToast("已退出登录", "info");
  setTimeout(() => window.location.reload(), 300);
}

// ============== 图片上传 ==============
async function handleImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  await processUploadedImage(file);
}

async function processUploadedImage(file) {
  if (!file.type.startsWith("image/")) { renderUploadMessage("请选择图片文件。"); return; }
  const rawDataUrl = await readFileAsDataURL(file);
  const dataUrl = await resizeImageDataUrl(rawDataUrl, 980, 0.82);
  uploadedImageData = dataUrl;
  uploadedImageUrl = ""; // 重置 Storage URL
  uploadedSemantic = null;
  uploadedFeature = await extractImageFeatures(dataUrl);
  els.imagePreview.innerHTML = `<img src="${dataUrl}" alt="上传的物品图片预览" />`;
  renderFeaturePreview(uploadedFeature, null, "正在调用视觉模型进行语义识别...");
  uploadedSemantic = await analyzeImageSemantics(dataUrl);
  renderFeaturePreview(uploadedFeature, uploadedSemantic);
}

function renderUploadMessage(message) {
  els.featurePreview.innerHTML = `<strong>图像特征与语义识别</strong><p>${escapeHtml(message)}</p>`;
}

function renderFeaturePreview(feature, semantic, statusText = "") {
  const colors = feature.palette.slice(0, 5).map((rgb) => `<span class="swatch" style="background:rgb(${rgb.join(",")})"></span>`).join("");
  const semanticHtml = semantic
    ? `<p>语义结果：${escapeHtml(semantic.object_name)} · ${escapeHtml(semantic.category)} · 置信度 ${Math.round(semantic.confidence * 100)}%<br/>特征：${escapeHtml(semantic.features.slice(0, 4).join("、") || "暂无")}</p>`
    : `<p>${escapeHtml(statusText || "未获得语义识别结果，将使用本地图像特征匹配。")}</p>`;
  els.featurePreview.innerHTML = `<strong>图像特征已提取</strong>
    <p>主色 RGB：${feature.dominantColor.join(", ")}<br/>感知哈希：${feature.hash.slice(0, 16)}...</p>
    <div class="swatch-row">${colors}</div>${semanticHtml}`;
}

// ============== 发布 ==============
async function handlePublish(event) {
  event.preventDefault();
  if (els.publishForm.classList.contains("is-submitting")) return;

  // 如果是编辑模式，走更新逻辑
  if (editingRecordId) {
    const form = new FormData(els.publishForm);
    const data = Object.fromEntries(form.entries());
    await handleUpdateRecord(data);
    return;
  }

  setSubmitLoading(true);
  try {
    const form = new FormData(els.publishForm);
    const data = Object.fromEntries(form.entries());
    const fallbackImage = createSyntheticImage({
      background: "#f3f6f4", primary: rgbToHex(colorMap[data.color] || [90, 110, 120]),
      secondary: "#ffffff", shape: data.category === "电子设备" ? "earbud" : data.category === "钥匙" ? "key" : data.category === "证件" ? "card" : "cup",
    }, data.title);
    let imageData = uploadedImageData || fallbackImage;
    
    // 如果有用户上传的图片且未上传到 Storage，先上传
    if (uploadedImageData && !uploadedImageUrl && uploadedImageData.startsWith("data:")) {
      try {
        const uploadResp = await fetch("/api/upload-image", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ imageData: uploadedImageData, recordId: `record-${Date.now()}` }),
        });
        if (uploadResp.ok) {
          const uploadResult = await uploadResp.json();
          if (uploadResult.url) {
            uploadedImageUrl = uploadResult.url;
            imageData = uploadResult.url;
          }
        }
      } catch (e) { /* 上传失败继续使用 Base64 */ }
    } else if (uploadedImageUrl) {
      imageData = uploadedImageUrl;
    }
    
    const imageFeature = uploadedFeature || (await extractImageFeatures(imageData));
    const newRecord = {
      id: `record-${Date.now()}`, type: data.type, title: data.title.trim(),
      category: data.category, color: data.color, location: data.location,
      time: data.time, contact: data.contact.trim(), description: data.description.trim(),
      status: data.type === "lost" ? "待找回" : "待认领",
      item_status: data.item_status || "unknown",
      custody_point_id: data.custody_point_id || "",
      owner_id: currentUser?.sub || "",
      imageData, imageFeature, semantic: uploadedSemantic || buildFallbackSemantic(data),
    };

    // 如果选择了代保管点，先寄存
    if (data.item_status === "custody" && data.custody_point_id) {
      const persisted = await persistRecord(newRecord);
      const saved = persisted || newRecord;
      records.unshift(saved);
      try {
        const depositResp = await fetch("/api/custody?action=deposit", {
          method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ record_id: saved.id, point_id: data.custody_point_id }),
        });
        const depositPayload = await depositResp.json();
        if (depositPayload.ok && depositPayload.pickup_code) {
          saved.pickup_code = depositPayload.pickup_code;
          saved.item_status = "custody";
          showToast(`寄存成功！取件码：${depositPayload.pickup_code}`, "success");
        }
      } catch (e) { /* 静默 */ }
    } else {
      const persisted = await persistRecord(newRecord);
      const saved = persisted || newRecord;
      records.unshift(saved);
    }

    resetPublishForm();
    renderAll();
    els.queryRecord.value = newRecord.id;
    switchView("match");

    // 匹配成功时推送通知
    const bestMatch = getBestMatch(newRecord);
    if (bestMatch.score >= 75 && currentUser) {
      try {
        await fetch("/api/notify?action=push", {
          method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ user_id: currentUser.sub, type: "match_found", title: "发现高匹配线索", body: `您发布的"${newRecord.title}"与一条${bestMatch.record.type === "lost" ? "寻物" : "招领"}记录匹配度达 ${Math.round(bestMatch.score)}%`, related_record_id: bestMatch.record.id }),
        });
      } catch (e) { /* 静默 */ }
    }
  } finally { setSubmitLoading(false); }
}

async function persistRecord(record) {
  try {
    const response = await fetch("/api/records", {
      method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ record }),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.record ? hydrateRecord(payload.record) : null;
  } catch (e) { return null; }
}

// ============== 编辑记录 ==============
let editingRecordId = null;

function openEditForm(recordId) {
  const record = records.find((r) => r.id === recordId);
  if (!record) { showToast("记录不存在", "error"); return; }
  if (currentUser && record.owner_id && record.owner_id !== currentUser.sub) {
    showToast("只能编辑自己发布的记录", "error"); return;
  }

  editingRecordId = recordId;

  // 填充表单
  const form = els.publishForm;
  form.querySelector('input[name="type"][value="' + record.type + '"]').checked = true;
  form.querySelector('input[name="title"]').value = record.title || "";
  form.querySelector('select[name="category"]').value = record.category || "";
  form.querySelector('select[name="color"]').value = record.color || "";
  form.querySelector('input[name="location"]').value = record.location || "";
  form.querySelector('input[name="time"]').value = record.time || "";
  form.querySelector('input[name="contact"]').value = record.contact || "";
  form.querySelector('textarea[name="description"]').value = record.description || "";

  // 设置图片预览
  if (record.imageData) {
    uploadedImageData = record.imageData;
    uploadedImageUrl = record.imageData.startsWith("http") ? record.imageData : "";
    els.imagePreview.innerHTML = `<img src="${record.imageData}" alt="物品图片预览" />`;
  }

  // 切换视图到发布页面
  switchView("publish");

  // 修改提交按钮文字
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = "保存修改";
}

async function handleUpdateRecord(data) {
  if (!editingRecordId) return;
  setSubmitLoading(true);
  try {
    const record = records.find((r) => r.id === editingRecordId);
    if (!record) { showToast("记录不存在", "error"); return; }

    let imageData = uploadedImageData || record.imageData || "";
    
    // 如果有新上传的图片且未上传到 Storage，先上传
    if (uploadedImageData && uploadedImageData.startsWith("data:") && !uploadedImageUrl) {
      try {
        const uploadResp = await fetch("/api/upload-image", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ imageData: uploadedImageData, recordId: editingRecordId }),
        });
        if (uploadResp.ok) {
          const uploadResult = await uploadResp.json();
          if (uploadResult.url) {
            uploadedImageUrl = uploadResult.url;
            imageData = uploadResult.url;
          }
        }
      } catch (e) { /* 上传失败继续使用 Base64 */ }
    } else if (uploadedImageUrl) {
      imageData = uploadedImageUrl;
    }
    
    const imageFeature = uploadedFeature || record.imageFeature || null;
    const semantic = uploadedSemantic || record.semantic || buildFallbackSemantic(data);

    const updatePayload = {
      id: editingRecordId,
      title: data.title.trim(),
      category: data.category,
      color: data.color,
      location: data.location,
      time: data.time,
      contact: data.contact.trim(),
      description: data.description.trim(),
      image_data: imageData,
      image_feature: imageFeature,
      semantic: semantic,
    };

    const response = await fetch("/api/records", {
      method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(updatePayload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      showToast(err.error || "更新失败", "error");
      return;
    }

    // 更新本地记录
    const idx = records.findIndex((r) => r.id === editingRecordId);
    if (idx >= 0) {
      records[idx] = {
        ...records[idx],
        title: updatePayload.title,
        category: updatePayload.category,
        color: updatePayload.color,
        location: updatePayload.location,
        time: updatePayload.time,
        contact: updatePayload.contact,
        description: updatePayload.description,
        imageData: imageData,
        imageFeature: imageFeature,
        semantic: semantic,
      };
    }

    editingRecordId = null;
    resetPublishForm();
    renderAll();
    switchView("home");
    showToast("更新成功", "success");
  } catch (e) {
    showToast("更新失败", "error");
  } finally {
    setSubmitLoading(false);
    const submitBtn = els.publishForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = "发布";
  }
}

function resetPublishForm() {
  editingRecordId = null;
  els.publishForm.reset();
  fillDefaultTime();
  uploadedFeature = null; uploadedImageData = ""; uploadedImageUrl = ""; uploadedSemantic = null;
  els.imagePreview.innerHTML = "<span>暂无图片</span>";
  els.featurePreview.innerHTML = "<strong>图像特征与语义识别</strong><p>上传图片后显示提取结果。</p>";
  els.itemStatusGroup.hidden = true;
  els.custodyPicker.hidden = true;
  els.aiInput.value = "";
  const submitBtn = els.publishForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = "发布";
}

// ============== 删除 ==============
async function deleteRecord(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  if (currentUser && record.owner_id && record.owner_id !== currentUser.sub) {
    showToast("只能删除自己发布的记录", "error"); return;
  }
  if (!isOwnRecord(record) && !currentUser) return;
  if (!confirm("确定删除这条发布记录吗？")) return;
  try {
    await fetch("/api/records", {
      method: "DELETE", headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ id }),
    });
    records = records.filter((item) => item.id !== id);
    if (els.detailDialog.open) els.detailDialog.close();
    renderAll();
    showToast("已删除", "success");
  } catch (e) { showToast("删除失败", "error"); }
}

// ============== 取件 ==============
async function handlePickup(event) {
  event.preventDefault();
  const form = new FormData(els.pickupForm);
  const data = Object.fromEntries(form.entries());
  const recordId = data.record_id;
  if (!recordId) { showToast("缺少记录 ID", "error"); return; }
  try {
    const response = await fetch("/api/custody?action=pickup", {
      method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ record_id: recordId, pickup_code: data.pickup_code }),
    });
    const payload = await response.json();
    if (!response.ok) { showToast(payload.error || "取件失败", "error"); return; }
    els.pickupDialog.close();
    showToast("取件成功！双方信用积分 +10", "success");
    records = await loadRecords();
    renderAll();
  } catch (e) { showToast("网络错误", "error"); }
}

// ============== Toast 通知 ==============
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  els.toastHost.appendChild(toast);
  setTimeout(() => { toast.classList.add("is-leaving"); setTimeout(() => toast.remove(), 400); }, 3000);
}

// ============== 工具函数 ==============
function setSubmitLoading(isLoading) {
  els.publishForm.classList.toggle("is-submitting", isLoading);
  els.submitButton.disabled = isLoading;
  els.submitButton.classList.toggle("is-loading", isLoading);
  els.submitButton.innerHTML = isLoading ? `<span class="button-spinner" aria-hidden="true"></span><span>正在发布...</span>` : "发布并计算匹配";
}

function isOwnRecord(record) {
  if (currentUser && record.owner_id === currentUser.sub) return true;
  return getOwnRecordIds().includes(String(record.id));
}

function getOwnRecordIds() {
  try {
    const raw = localStorage.getItem("campus-lost-found-own-record-ids");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch (e) { return []; }
}

function fillDefaultTime() {
  const input = els.publishForm.querySelector('input[name="time"]');
  const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  input.value = now.toISOString().slice(0, 16);
}

function formatTime(value) {
  try { const d = new Date(value); return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
  catch (e) { return String(value); }
}

function isToday(value) {
  const now = new Date(); const d = new Date(value);
  return now.getFullYear() === d.getFullYear() && now.getMonth() === d.getMonth() && now.getDate() === d.getDate();
}

function escapeHtml(value) { const div = document.createElement("div"); div.textContent = String(value ?? ""); return div.innerHTML; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function rgbToHex([r, g, b]) { return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`; }

// ============== 匹配算法 ==============
function getBestMatch(record) { return getMatchesFor(record)[0]?.result || { score: 0 }; }

function getMatchesFor(record) {
  return records
    .filter((c) => c.id !== record.id && c.type !== record.type)
    .map((c) => ({ record: c, result: calculateMatch(record, c) }))
    .sort((a, b) => b.result.score - a.result.score);
}

function calculateMatch(a, b) {
  const breakdown = {
    category: compareCategory(a.category, b.category) * 100,
    color: compareColorText(a.color, b.color) * 100,
    location: compareLocation(a.location, b.location) * 100,
    time: compareTime(a.time, b.time) * 100,
    text: compareTextSimilarity(`${a.title} ${a.description}`, `${b.title} ${b.description}`) * 100,
    image: compareImages(a.imageFeature, b.imageFeature) * 100,
    semantic: compareSemantics(a, b) * 100,
  };
  const score = Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + breakdown[key] * weight, 0);
  return { score: clamp(score, 0, 100), breakdown, reasons: buildReasons(a, b, breakdown) };
}

function compareCategory(a, b) {
  if (a === b) return 1;
  if (categoryRelated[a]?.includes(b) || categoryRelated[b]?.includes(a)) return 0.46;
  return 0.08;
}

function compareColorText(a, b) {
  if (a === b) return 1;
  return colorDistanceScore(colorMap[a] || [128, 128, 128], colorMap[b] || [128, 128, 128]);
}

function compareLocation(a, b) {
  const nA = normalizeLocation(a); const nB = normalizeLocation(b);
  if (nA === nB) return 1;
  if (nA.slice(0, 2) === nB.slice(0, 2)) return 0.86;
  if (locationGroups[nA]?.includes(nB) || locationGroups[nB]?.includes(nA)) return 0.68;
  return 0.18;
}

function normalizeLocation(loc) {
  for (const key of Object.keys(locationGroups)) { if (loc.includes(key)) return key; }
  return loc;
}

function compareTime(a, b) {
  const delta = Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 36e5;
  if (delta <= 0.5) return 1; if (delta <= 2) return 0.86; if (delta <= 8) return 0.58; if (delta <= 24) return 0.32; return 0.12;
}

function compareTextSimilarity(a, b) {
  const tA = tokenize(a); const tB = tokenize(b);
  if (!tA.size || !tB.size) return 0;
  const intersection = [...tA].filter((t) => tB.has(t)).length;
  const union = new Set([...tA, ...tB]).size;
  return clamp((intersection / union) * 0.58 + diceCoefficient(normalizeText(a), normalizeText(b)) * 0.42, 0, 1);
}

function compareImages(a, b) {
  if (!a || !b) return 0.25;
  return clamp(cosineSimilarity(a.histogram, b.histogram) * 0.58 + (1 - hammingDistance(a.hash, b.hash) / a.hash.length) * 0.3 + colorDistanceScore(a.dominantColor, b.dominantColor) * 0.12, 0, 1);
}

function compareSemantics(a, b) {
  const sA = a.semantic || buildFallbackSemantic(a); const sB = b.semantic || buildFallbackSemantic(b);
  const nameScore = compareTextSimilarity(sA.object_name, sB.object_name);
  const catScore = compareCategory(sA.category, sB.category);
  const colorScore = compareSemanticColors(sA.colors, sB.colors);
  const featScore = compareTextSimilarity(`${sA.features.join(" ")} ${sA.visible_text.join(" ")}`, `${sB.features.join(" ")} ${sB.visible_text.join(" ")}`);
  const brandScore = (sA.brand_guess && sB.brand_guess && sA.brand_guess !== "未知" && sB.brand_guess !== "未知") ? compareTextSimilarity(sA.brand_guess, sB.brand_guess) : 0.35;
  const conf = (Number(sA.confidence || 0.5) + Number(sB.confidence || 0.5)) / 2;
  return clamp((nameScore * 0.28 + catScore * 0.2 + colorScore * 0.16 + featScore * 0.26 + brandScore * 0.1) * (0.75 + conf * 0.25), 0, 1);
}

function compareSemanticColors(a, b) {
  const arrA = Array.isArray(a) ? a : []; const arrB = Array.isArray(b) ? b : [];
  if (!arrA.length || !arrB.length) return 0.35;
  return Math.max(...arrA.flatMap((cA) => arrB.map((cB) => compareColorText(cA, cB))));
}

function buildReasons(a, b, bd) {
  const reasons = [];
  if (bd.category >= 85) reasons.push("物品类别一致，是强匹配因素");
  else if (bd.category >= 40) reasons.push("物品类别存在关联");
  if (bd.location >= 80) reasons.push("地点高度接近");
  else if (bd.location >= 55) reasons.push("地点属于相邻区域");
  if (bd.time >= 80) reasons.push("时间间隔较短");
  else if (bd.time >= 45) reasons.push("时间间隔可接受");
  if (bd.image >= 75) reasons.push("图片视觉结构相似");
  if (bd.semantic >= 78) reasons.push("AI 语义识别高度相似");
  else if (bd.semantic >= 55) reasons.push("语义标签部分重合");
  const shared = [...tokenize(`${a.title} ${a.description}`)].filter((t) => tokenize(`${b.title} ${b.description}`).has(t));
  if (shared.length) reasons.push(`描述关键词重合：${shared.slice(0, 4).join("、")}`);
  if (bd.color >= 85) reasons.push(`颜色均接近${a.color}`);
  if (!reasons.length) reasons.push("存在少量字段相似，仍需人工核验");
  return reasons.slice(0, 5);
}

function buildFallbackSemantic(record) {
  return { object_name: record.title || "未知物品", category: record.category || "其他", colors: [record.color].filter(Boolean), brand_guess: "未知", visible_text: [], features: [...tokenize(`${record.title || ""} ${record.description || ""}`)].slice(0, 10), confidence: 0.45 };
}

async function analyzeImageSemantics(imageData) {
  try {
    const response = await fetch("/api/analyze-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageData }) });
    if (!response.ok) return null;
    return (await response.json()).semantic || null;
  } catch (e) { return null; }
}

// ============== 图像处理 ==============
async function extractImageFeatures(dataUrl) {
  const image = await loadImage(dataUrl);
  const size = 32; const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const histogram = new Array(64).fill(0); const colors = []; const gray = [];
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255; if (alpha < 0.2) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    histogram[(Math.floor(r / 64) << 4) + (Math.floor(g / 64) << 2) + Math.floor(b / 64)] += 1;
    colors.push([r, g, b]); gray.push(0.299 * r + 0.587 * g + 0.114 * b);
  }
  const total = histogram.reduce((s, v) => s + v, 0) || 1;
  const normalizedHistogram = histogram.map((v) => v / total);
  const dominantColor = getDominantColor(colors);
  const palette = getPalette(colors);
  const avgGray = gray.reduce((s, v) => s + v, 0) / (gray.length || 1);
  const hash = gray.map((v) => (v >= avgGray ? "1" : "0")).join("");
  return { histogram: normalizedHistogram, dominantColor, palette, hash };
}

function getDominantColor(colors) {
  if (!colors.length) return [128, 128, 128];
  const buckets = new Map();
  colors.forEach(([r, g, b]) => { const key = `${Math.round(r / 32) * 32},${Math.round(g / 32) * 32},${Math.round(b / 32) * 32}`; buckets.set(key, (buckets.get(key) || 0) + 1); });
  const [key] = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0];
  return key.split(",").map((v) => clamp(Number(v), 0, 255));
}

function getPalette(colors) {
  const buckets = new Map();
  colors.forEach(([r, g, b]) => { const key = `${Math.round(r / 48) * 48},${Math.round(g / 48) * 48},${Math.round(b / 48) * 48}`; buckets.set(key, (buckets.get(key) || 0) + 1); });
  return [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([key]) => key.split(",").map((v) => clamp(Number(v), 0, 255)));
}

function createSyntheticImage(seed, label) {
  const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 480;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = seed.background; ctx.fillRect(0, 0, 640, 480);
  ctx.fillStyle = "rgba(255,255,255,0.46)"; ctx.fillRect(34, 34, 572, 412);
  ctx.fillStyle = seed.primary; ctx.strokeStyle = seed.secondary; ctx.lineWidth = 16;
  if (seed.shape === "card") drawCard(ctx, seed);
  if (seed.shape === "earbud") drawEarbud(ctx, seed);
  if (seed.shape === "umbrella") drawUmbrella(ctx, seed);
  if (seed.shape === "key") drawKey(ctx, seed);
  if (seed.shape === "cup") drawCup(ctx, seed);
  ctx.fillStyle = "rgba(24,32,43,0.72)"; ctx.font = "bold 32px Microsoft YaHei, sans-serif";
  ctx.fillText(label.slice(0, 10), 54, 424);
  return canvas.toDataURL("image/png");
}

function drawCard(ctx, s) { roundRect(ctx, 145, 130, 350, 220, 28); ctx.fill(); ctx.stroke(); ctx.fillStyle = s.secondary; roundRect(ctx, 190, 184, 160, 20, 10); ctx.fill(); roundRect(ctx, 190, 232, 240, 18, 9); ctx.fill(); ctx.fillStyle = "#e9a227"; ctx.beginPath(); ctx.arc(446, 168, 22, 0, Math.PI * 2); ctx.fill(); }
function drawEarbud(ctx, s) { roundRect(ctx, 190, 185, 260, 150, 54); ctx.fill(); ctx.stroke(); ctx.fillStyle = s.secondary; ctx.beginPath(); ctx.arc(260, 255, 24, 0, Math.PI * 2); ctx.arc(380, 255, 24, 0, Math.PI * 2); ctx.fill(); }
function drawUmbrella(ctx, s) { ctx.beginPath(); ctx.arc(320, 250, 150, Math.PI, 0); ctx.lineTo(170, 250); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = s.secondary; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(320, 250); ctx.lineTo(320, 345); ctx.quadraticCurveTo(320, 390, 370, 370); ctx.stroke(); }
function drawKey(ctx, s) { ctx.beginPath(); ctx.arc(230, 250, 62, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = s.background; ctx.beginPath(); ctx.arc(230, 250, 28, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = s.primary; roundRect(ctx, 280, 232, 210, 36, 18); ctx.fill(); ctx.fillRect(420, 268, 28, 52); ctx.fillRect(462, 268, 28, 36); }
function drawCup(ctx, s) { roundRect(ctx, 230, 120, 180, 245, 36); ctx.fill(); ctx.stroke(); ctx.strokeStyle = s.secondary; ctx.beginPath(); ctx.arc(416, 230, 52, -Math.PI / 2, Math.PI / 2); ctx.stroke(); }
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }

function loadImage(src) { return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src; }); }
function readFileAsDataURL(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }

async function resizeImageDataUrl(dataUrl, maxSide, quality) {
  const image = await loadImage(dataUrl);
  const largest = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
  if (!largest || (largest <= maxSide && dataUrl.length < 900000)) return dataUrl;
  const scale = Math.min(1, maxSide / largest);
  const w = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const h = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d"); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(image, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

// ============== 文本工具 ==============
function tokenize(text) {
  const normalized = normalizeText(text); const words = new Set();
  const keywords = ["校园卡", "学生卡", "门禁卡", "卡套", "耳机", "充电盒", "钥匙", "水杯", "雨伞", "图书馆", "食堂", "教学楼", "宿舍", "贴纸", "划痕", "挂件", "透明", "蓝色", "白色", "黑色", "银色", "绿色", "背包", "双肩包", "笔记本", "电脑", "地铁站", "公交", "派出所", "便利店"];
  keywords.forEach((k) => { if (normalized.includes(k)) words.add(k); });
  for (let i = 0; i < normalized.length - 1; i += 1) words.add(normalized.slice(i, i + 2));
  return words;
}

function diceCoefficient(a, b) {
  if (!a || !b) return 0;
  const gA = bigrams(a); const gB = bigrams(b);
  if (!gA.length || !gB.length) return a === b ? 1 : 0;
  const counts = new Map(); gA.forEach((g) => counts.set(g, (counts.get(g) || 0) + 1));
  let overlap = 0; gB.forEach((g) => { const c = counts.get(g) || 0; if (c > 0) { overlap += 1; counts.set(g, c - 1); } });
  return (2 * overlap) / (gA.length + gB.length);
}

function bigrams(v) { const g = []; for (let i = 0; i < v.length - 1; i += 1) g.push(v.slice(i, i + 2)); return g; }
function normalizeText(v) { return String(v || "").toLowerCase().replace(/\s+/g, "").replace(/[，。！？、,.!?;；:：()（）【】\[\]{}]/g, ""); }
function cosineSimilarity(a, b) { let dot = 0, nA = 0, nB = 0; for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; nA += a[i] * a[i]; nB += b[i] * b[i]; } return (!nA || !nB) ? 0 : dot / (Math.sqrt(nA) * Math.sqrt(nB)); }
function hammingDistance(a, b) { const len = Math.min(a.length, b.length); let d = 0; for (let i = 0; i < len; i++) if (a[i] !== b[i]) d++; return d + Math.abs(a.length - b.length); }
function colorDistanceScore(a, b) { return clamp(1 - Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) / 441.67, 0, 1); }
