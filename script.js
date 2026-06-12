"use strict";

// ============================================================
// 拾寻 v3 — 城市拾遗网络 前端核心逻辑
// ============================================================

// ============== 常量与配置 ==============
const WEIGHTS = { category: 0.13, color: 0.08, location: 0.14, time: 0.11, text: 0.14, image: 0.2, semantic: 0.2 };

// 等级称号映射
const LEVEL_TITLES = {
  1: "拾遗新手", 2: "拾遗新手",
  3: "热心市民", 4: "热心市民",
  5: "城市好心人", 6: "城市好心人",
  7: "拾金不昧达人", 8: "拾金不昧达人",
  9: "城市守护者", 10: "城市守护者",
};

// 徽章稀有度颜色
const BADGE_RARITY = {
  "🌱 新手上路": "common",
  "✅ 实名认证": "rare",
  "📝 初次发布": "common",
  "🎯 匹配达人": "rare",
  "🤝 助人为乐": "epic",
  "🔥 连续活跃": "rare",
  "🏆 城市守护者": "legendary",
};

const colorMap = {
  黑色: [26, 30, 38], 白色: [238, 240, 235], 蓝色: [54, 105, 201],
  红色: [214, 78, 68], 黄色: [232, 175, 50], 绿色: [30, 150, 100],
  银色: [176, 184, 190], 灰色: [140, 140, 140], 粉色: [240, 150, 170], 透明: [202, 224, 229],
};

const categoryRelated = {
  证件: ["学习用品"], 电子设备: ["学习用品", "箱包"], 生活用品: ["钥匙"],
  学习用品: ["证件", "电子设备"], 钥匙: ["生活用品"], 箱包: ["电子设备"], 贵重物品: ["电子设备"], 其他: [],
};

// 城市级地点邻接（北京市扩展版）
const locationGroups = {
  // 朝阳区核心商圈
  "国贸": ["大望路", "建国门"], "大望路": ["国贸", "四惠"],
  "三里屯": ["工体", "亮马桥"], "工体": ["三里屯", "东直门"],
  "望京": ["酒仙桥", "大屯"], "酒仙桥": ["望京", "将台"],
  // 海淀区高校圈
  "中关村": ["五道口", "知春路"], "五道口": ["中关村", "清华东路"],
  "西直门": ["积水潭", "大钟寺"],
  // 交通枢纽
  "北京南站": ["陶然亭", "马家堡"], "北京西站": ["六里桥", "军事博物馆"],
  "北京站": ["建国门", "东单"],
  // 传媒大学周边
  "中国传媒大学": ["双桥", "管庄", "三间房街道"], "双桥": ["中国传媒大学", "管庄"],
  "三间房街道": ["中国传媒大学", "管庄", "常营"],
};

// 区→街道映射（北京市 v4 地域结构化）
const STREET_DATA = {
  "东城区": ["东华门", "景山", "交道口", "安定门", "北新桥", "东四", "朝阳门", "建国门", "东直门", "和平里", "前门", "崇文门外", "东花市", "龙潭", "体育馆路", "天坛", "永定门外"],
  "西城区": ["西长安街", "新街口", "德胜门", "什刹海", "大栅栏", "天桥", "椿树", "陶然亭", "广安门内", "牛街", "白纸坊", "广安门外", "展览路", "月坛", "金融街"],
  "朝阳区": ["建外街道", "朝外街道", "呼家楼", "三里屯", "左家庄", "香河园", "和平街", "安贞", "亚运村", "小关", "酒仙桥", "麦子店", "团结湖", "六里屯", "八里庄", "双井", "劲松", "潘家园", "南磨房", "高碑店", "三间房街道", "中国传媒大学", "管庄", "常营", "平房", "东坝", "金盏", "将台", "太阳宫", "大屯", "望京", "奥运村", "来广营", "崔各庄", "孙河", "东湖"],
  "丰台区": ["右安门", "太平桥", "西罗园", "大红门", "南苑", "东高地", "东铁匠营", "刘家窑", "方庄", "石榴庄", "玉泉营", "花乡", "看丹", "丰台", "新村", "长辛店", "云岗", "北宫", "王佐"],
  "石景山区": ["八宝山", "老山", "八角", "古城", "苹果园", "金顶街", "广宁", "五里坨", "鲁谷"],
  "海淀区": ["万寿路", "永定路", "羊坊店", "甘家口", "八里庄", "紫竹院", "北下关", "北太平庄", "海淀", "中关村", "学院路", "清河", "青龙桥", "西三旗", "马连洼", "花园路", "田村路", "上地", "万柳", "东升", "西北旺", "温泉", "香山", "四季青"],
  "门头沟区": ["大峪", "城子", "东辛房", "大台", "王平", "永定", "龙泉", "潭柘寺", "军庄", "雁翅", "斋堂", "清水"],
  "房山区": ["城关", "新镇", "向阳", "东风", "迎风", "星城", "良乡", "拱辰", "西潞", "阎村", "窦店", "石楼", "长阳", "河北", "长沟", "大石窝", "张坊", "十渡", "青龙湖", "韩村河", "霞云岭", "南窖", "佛子庄", "大安山", "史家营", "蒲洼"],
  "通州区": ["中仓", "新华", "北苑", "玉桥", "潞源", "通运", "宋庄", "张家湾", "漷县", "马驹桥", "西集", "台湖", "永乐店", "潞城", "永顺", "梨园", "于家务"],
  "顺义区": ["胜利", "光明", "仁和", "后沙峪", "天竺", "杨镇", "牛栏山", "南法信", "马坡", "石园", "空港", "双丰", "高丽营", "李桥", "李遂", "南彩", "北务", "大孙各庄", "张镇", "龙湾屯", "木林", "北小营", "北石槽", "赵全营"],
  "昌平区": ["城北", "城南", "天通苑北", "天通苑南", "霍营", "回龙观", "龙泽园", "史各庄", "东小口", "沙河", "南口", "马池口", "百善", "小汤山", "崔村", "兴寿", "阳坊", "十三陵", "延寿", "南邵", "北七家"],
  "大兴区": ["兴丰", "林校路", "清源", "亦庄", "黄村", "旧宫", "西红门", "瀛海", "观音寺", "天宫院", "高米店", "荣华", "博兴", "青云店", "采育", "安定", "礼贤", "榆垡", "庞各庄", "北臧村", "魏善庄", "长子营"],
  "怀柔区": ["泉河", "龙山", "怀柔", "雁栖", "庙城", "北房", "杨宋", "桥梓", "怀北", "汤河口", "渤海", "九渡河", "琉璃庙", "宝山", "长哨营", "喇叭沟门"],
  "平谷区": ["滨河", "兴谷", "平谷", "峪口", "马坊", "金海湖", "东高村", "山东庄", "南独乐河", "大华山", "夏各庄", "马昌营", "王辛庄", "大兴庄", "刘家店", "镇罗营", "黄松峪", "熊儿寨"],
  "密云区": ["鼓楼", "果园", "檀营", "密云", "溪翁庄", "西田各庄", "十里堡", "河南寨", "巨各庄", "穆家峪", "太师屯", "高岭", "不老屯", "冯家峪", "古北口", "大城子", "东邵渠", "北庄", "新城子", "石城"],
  "延庆区": ["百泉", "香水园", "儒林", "延庆", "康庄", "八达岭", "永宁", "旧县", "张山营", "四海", "千家店", "沈家营", "大榆树", "井庄", "大庄科", "刘斌堡", "香营", "珍珠泉"],
};

const ITEM_STATUS_LABELS = {
  in_place: "📍 仍在原地", custody: "🤝 代为保管",
  picked: "✅ 已取回", institution: "🏛️ 已交机构", unknown: "❓ 不确定",
};

const AUTH_TOKEN_KEY = "shiyun_auth_token";
const ACCOUNTS_KEY = "shiyun_accounts"; // 存储所有登录过的账号列表
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
  bindLocationCascade();
  restoreAuth();
  records = await loadRecords();
  custodyPoints = await loadCustodyPoints();
  fillDefaultTime();
  renderLocationFilters();
  // 默认筛选：朝阳区 + 中国传媒大学
  if (els.filterDistrict) {
    els.filterDistrict.value = "朝阳区";
    renderLocationStreets();
    if (els.filterStreet) {
      els.filterStreet.value = "中国传媒大学";
    }
  }
  renderAll();
  updateNotifyBadge(0);
  startNotifyPoll();
  checkHighMatchAlerts();
  checkUserStreak();
  initMascot();

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
    "featurePreview", "metricGrid", "detailDialog", "detailContent",
    "closeDialog", "topAuthBtn", "topVerifyBtn", "mobileAuthBtn",
    "loginDialog", "loginForm", "loginGuestBtn", "closeLoginBtn",
    "verifyDialog", "verifyForm", "closeVerifyBtn",
    "pickupDialog", "pickupForm", "closePickupBtn",
    "aiInput", "aiExtractBtn", "aiExtractHint",
    "itemStatusGroup", "custodyPicker", "custodyPointSelect", "claimQuestionGroup",
    "notifyList", "markAllReadBtn", "notifyBadge", "notifyBadgeMobile",
    "profileContent", "toastHost", "floatNotifyHost", "userStatusBar",
    "filterDistrict", "filterStreet",
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

  // 筛选（顶部 type filter：失物/招领/全部）
  document.querySelectorAll(".view-switcher [data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      document.querySelectorAll(".view-switcher [data-filter]").forEach((c) => c.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderItemList();
    });
  });

  // 类别 chip 筛选
  document.querySelectorAll("#filterChips .filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const val = chip.dataset.filter;
      // 同步到隐藏的 select
      if (els.categoryFilter) els.categoryFilter.value = val;
      // 更新 chip 视觉状态
      document.querySelectorAll("#filterChips .filter-chip").forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      renderItemList();
    });
  });

  on(els.searchInput, "input", renderItemList);
  if (els.categoryFilter) on(els.categoryFilter, "change", renderItemList);
  on(els.filterDistrict, "change", () => { renderLocationStreets(); renderItemList(); });
  on(els.filterStreet, "change", renderItemList);
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
      if (els.claimQuestionGroup) els.claimQuestionGroup.hidden = !isFound;
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
  if (!els.dropZone) return;
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
  if (!token) {
    // 无登录态时自动静默登录演示账号
    autoLoginDemo();
    return;
  }
  try {
    const payload = decodeJwtPayload(token);
    if (payload.exp && Date.now() / 1000 > payload.exp) { localStorage.removeItem(AUTH_TOKEN_KEY); autoLoginDemo(); return; }
    // 页面刷新恢复登录时，JWT的exp是过期时间戳，不能作为经验值使用
    // 经验值应从用户对象获取，此处先设为0，后续可通过/api/auth?action=me获取完整信息
    currentUser = { ...payload, exp: 0 };
    updateAuthUI();
  } catch (e) { localStorage.removeItem(AUTH_TOKEN_KEY); autoLoginDemo(); }
}

// 自动登录演示账号（单用户模式）
async function autoLoginDemo() {
  try {
    const response = await fetch("/api/auth?action=guest-login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: "拾小寻" }),
    });
    const payload = await response.json();
    if (!response.ok) { updateAuthUI(); return; }
    localStorage.setItem(AUTH_TOKEN_KEY, payload.token);
    const jwtPayload = decodeJwtPayload(payload.token);
    currentUser = { ...jwtPayload, ...payload.user, exp: payload.user?.exp ?? 0 };
    updateAuthUI();
    renderAll();
  } catch (e) { updateAuthUI(); }
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
    els.topAuthBtn.textContent = "登录";
    els.topAuthBtn.classList.remove("is-logged-in");
    els.topAuthBtn.onclick = () => autoLoginDemo();
    els.mobileAuthBtn.textContent = "登录";
    els.mobileAuthBtn.onclick = () => autoLoginDemo();
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

  renderAccountList();
  document.querySelector("#userDialog")?.showModal();
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
    // 合并 JWT payload 和 user 对象数据，显式排除 JWT 标准字段避免覆盖用户数据
    const jwtPayload = decodeJwtPayload(payload.token);
    currentUser = { ...jwtPayload, ...payload.user, exp: payload.user?.exp ?? 0 };
    addAccount(payload.token, payload.user);
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
    const jwtPayload2 = decodeJwtPayload(payload.token);
    currentUser = { ...jwtPayload2, ...payload.user, exp: payload.user?.exp ?? 0 };
    addAccount(payload.token, payload.user);
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
    const jwtPayload3 = decodeJwtPayload(payload.token);
    currentUser = { ...jwtPayload3, ...payload.user, exp: payload.user?.exp ?? 0 };
    addAccount(payload.token, payload.user);
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

  // 结构化地点自动填充级联选择器
  const districtSelect = form.querySelector('select[name="district"]');
  const streetSelect = form.querySelector('select[name="street"]');
  const detailInput = form.querySelector('input[name="detail_location"]');
  if (districtSelect && s.district) {
    setSelectValue(districtSelect, s.district);
    const event = new Event("change");
    districtSelect.dispatchEvent(event);
  }
  if (streetSelect && s.street) {
    setTimeout(() => { setSelectValue(streetSelect, s.street); }, 50);
  }
  if (detailInput && s.detail_location) {
    detailInput.value = s.detail_location;
  }

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
  renderCustodyOptions();
  renderUserStatusBar();
  renderInspector();
}

function renderItemList() {
  const query = normalizeText(els.searchInput.value);
  const category = els.categoryFilter?.value || "all";
  const district = els.filterDistrict?.value || "all";
  const street = els.filterStreet?.value || "all";
  let list = records.slice().sort((a, b) => new Date(b.time) - new Date(a.time));
  list = list.filter((r) => {
    const haystack = normalizeText(`${r.title}${r.category}${r.color}${r.location}${r.description}`);
    const matchesSearch = !query || haystack.includes(query);
    const matchesCategory = category === "all" || r.category === category;
    const matchesDistrict = district === "all" || r.district === district;
    const matchesStreet = street === "all" || r.street === street || (street === "中国传媒大学" && normalizeText(r.location).includes("传媒大学"));
    const matchesType = activeFilter === "all" || r.type === activeFilter ||
      (activeFilter === "hot" && getBestMatch(r).score >= 75) ||
      (activeFilter === "institution" && r.item_status === "institution");
    return matchesSearch && matchesCategory && matchesDistrict && matchesStreet && matchesType;
  });
  els.itemList.innerHTML = list.length
    ? list.map((r) => renderRecordCard(r)).join("")
    : `<div class="empty-state"><strong>没有找到符合条件的信息</strong><p>尝试调整筛选条件或搜索关键词，看看其他物品吧</p></div>`;
  bindCardActions();
  updateHomeStatsFromList(list);
  renderActiveFilters();
}

// 渲染当前激活的筛选标签
function renderActiveFilters() {
  const container = document.getElementById("activeFilters");
  if (!container) return;
  const tags = [];
  const category = els.categoryFilter?.value || "all";
  const district = els.filterDistrict?.value || "all";
  const street = els.filterStreet?.value || "all";
  if (category !== "all") tags.push({ type: "category", label: category, text: `类别：${category}` });
  if (district !== "all") tags.push({ type: "district", label: district, text: `📍 ${district}` });
  if (street !== "all") tags.push({ type: "street", label: street, text: `🏘️ ${street}` });
  if (tags.length === 0) { container.innerHTML = ""; return; }
  container.innerHTML = tags.map(t => `
    <span class="active-filter-tag">${escapeHtml(t.text)} <button onclick="clearFilter('${t.type}')">✕</button></span>
  `).join("");
}

// 渲染 Inspector 右侧栏
function renderInspector() {
  const filtersEl = document.getElementById("inspectorFilters");
  const tagsEl = document.getElementById("inspectorTags");
  if (!filtersEl || !tagsEl) return;

  // 当前筛选摘要
  const district = els.filterDistrict?.value || "all";
  const street = els.filterStreet?.value || "all";
  const query = els.searchInput?.value?.trim() || "";
  const filterItems = [];
  if (district !== "all") filterItems.push({ label: `📍 ${district}`, color: "#0071e3" });
  if (street !== "all") filterItems.push({ label: `🏘️ ${street}`, color: "#34c759" });
  if (query) filterItems.push({ label: `🔍 ${query}`, color: "#ff9500" });

  if (filterItems.length === 0) {
    filtersEl.innerHTML = `<p class="inspector-placeholder">暂无筛选，显示全部信息</p>`;
  } else {
    filtersEl.innerHTML = filterItems.map(f => `
      <div class="inspector-filter-item"><span class="filter-dot" style="background:${f.color}"></span>${escapeHtml(f.label)}</div>
    `).join("");
  }

  // 热门标签：从记录中提取高频类别
  const categoryCounts = {};
  records.forEach(r => { categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1; });
  const topTags = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat]) => cat);

  if (topTags.length === 0) {
    tagsEl.innerHTML = `<p class="inspector-placeholder">暂无数据</p>`;
  } else {
    tagsEl.innerHTML = topTags.map(tag => `
      <span class="inspector-tag" onclick="setCategoryFilter('${escapeHtml(tag)}')">${escapeHtml(tag)}</span>
    `).join("");
  }
}

// 从 Inspector 标签设置类别筛选
function setCategoryFilter(category) {
  if (els.categoryFilter) els.categoryFilter.value = category;
  // 同步 chip 状态
  document.querySelectorAll(".filter-chip").forEach(chip => {
    chip.classList.toggle("is-active", chip.dataset.filter === category);
  });
  renderItemList();
}

// 清除单个筛选条件
function clearFilter(type) {
  if (type === "category" && els.categoryFilter) els.categoryFilter.value = "all";
  if (type === "district" && els.filterDistrict) { els.filterDistrict.value = "all"; renderLocationStreets(); }
  if (type === "street" && els.filterStreet) els.filterStreet.value = "all";
  // 同步 chip 状态
  document.querySelectorAll(".filter-chip").forEach(chip => {
    chip.classList.toggle("is-active", chip.dataset.filter === "all");
  });
  renderItemList();
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
  const adminActions = isAdmin() && !isOwn ? `<button class="danger-button" data-admin-delete-id="${record.id}" type="button">管理员删除</button>` : "";
  const defaultSeed = { background: "#e8ecf0", primary: "#6b7280", secondary: "#9ca3af", shape: "card" };
  const imgSrc = record.imageData || createSyntheticImage(record.visualSeed || defaultSeed, record.title);
  // 优先使用结构化地点展示
  const locationDisplay = record.district && record.street
    ? `${escapeHtml(record.district)} · ${escapeHtml(record.street)}`
    : escapeHtml(record.location);
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
          <span class="meta-pill">${locationDisplay}</span>
          ${institutionBadge}${custodyBadge}${fuzzyBadge}
        </div>
        <p>${escapeHtml(record.description)}</p>
        <div class="meta-line" style="color:var(--text3);font-size:12px;">${formatTime(record.time)} · ${escapeHtml(record.status)}${statusLabel ? " · " + statusLabel : ""}</div>
        <div class="card-actions">
          <button class="ghost-button" data-detail-id="${record.id}" type="button">详情</button>
          <button class="ghost-button" data-match-id="${record.id}" type="button">匹配</button>
          ${record.item_status === "custody" && record.type === "found" ? `<button class="ghost-button pickup-btn" data-pickup-id="${record.id}" type="button">取件</button>` : ""}
          ${ownActions}${adminActions}
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
  container.querySelectorAll("[data-admin-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (confirm("管理员确认删除此记录？")) deleteRecord(btn.dataset.adminDeleteId);
    });
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
    : `<div class="empty-state"><strong>当前没有可匹配的信息</strong><p>发布一条信息，AI 会为你自动寻找匹配线索</p></div>`;
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
  const score = Math.round(result.score);
  const scoreColor = score >= 80 ? "#34c759" : score >= 60 ? "#ff9500" : "#0071e3";
  const ringOffset = 100 - score;
  return `<article class="match-item">
    <div class="match-item-media">
      <img src="${record.imageData}" alt="${escapeHtml(record.title)}" />
      <div class="match-score-ring" style="--score:${score};--ring-color:${scoreColor}">
        <svg viewBox="0 0 36 36">
          <path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          <path class="ring-fill" stroke-dasharray="${score}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        </svg>
        <span class="ring-text">${score}%</span>
      </div>
    </div>
    <div class="match-item-body">
      <div class="meta-line">
        <span class="status-badge ${record.type}">${record.type === "lost" ? "寻物" : "招领"}</span>
        ${score >= 80 ? '<span class="match-recommend">🔥 强烈推荐</span>' : ''}
      </div>
      <h4>${escapeHtml(record.title)}</h4>
      <div class="match-dimensions">
        <div class="match-dimension" style="--dim-width:${parts.category}%;--dim-color:#0071e3"><span class="dim-label">类别</span><div class="dim-bar"><div class="dim-fill"></div></div><span class="dim-val">${Math.round(parts.category)}%</span></div>
        <div class="match-dimension" style="--dim-width:${parts.color}%;--dim-color:#af52de"><span class="dim-label">颜色</span><div class="dim-bar"><div class="dim-fill"></div></div><span class="dim-val">${Math.round(parts.color)}%</span></div>
        <div class="match-dimension" style="--dim-width:${parts.location}%;--dim-color:#34c759"><span class="dim-label">地点</span><div class="dim-bar"><div class="dim-fill"></div></div><span class="dim-val">${Math.round(parts.location)}%</span></div>
        <div class="match-dimension" style="--dim-width:${parts.time}%;--dim-color:#ff9500"><span class="dim-label">时间</span><div class="dim-bar"><div class="dim-fill"></div></div><span class="dim-val">${Math.round(parts.time)}%</span></div>
        <div class="match-dimension" style="--dim-width:${parts.text}%;--dim-color:#ff3b30"><span class="dim-label">文本</span><div class="dim-bar"><div class="dim-fill"></div></div><span class="dim-val">${Math.round(parts.text)}%</span></div>
        <div class="match-dimension" style="--dim-width:${parts.image}%;--dim-color:#5856d6"><span class="dim-label">图像</span><div class="dim-bar"><div class="dim-fill"></div></div><span class="dim-val">${Math.round(parts.image)}%</span></div>
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
  // 数据概览页统计（原有逻辑）
  const total = records.length;
  const today = records.filter((r) => isToday(r.time)).length;
  const strong = records.filter((r) => getBestMatch(r).score >= 80).length;
  const withSemantic = records.filter((r) => r.semantic).length;
  const metrics = [["发布总数", total], ["今日新增", today], ["高匹配线索", strong], ["语义识别记录", withSemantic]];
  els.metricGrid.innerHTML = metrics
    .map(([label, value]) => `<div class="metric-card"><strong>${label}</strong><span>${value}</span></div>`).join("");

  // 主界面成就统计面板
  updateHomeStats();
}

// 更新主界面成就统计面板（基于全部记录）
function updateHomeStats() {
  updateHomeStatsFromList(records);
}

// 基于指定记录列表更新统计面板
function updateHomeStatsFromList(list) {
  // 已找回：状态为"已找回"或"已认领"的记录数
  const recovered = list.filter((r) => r.status === "已找回" || r.status === "已认领").length;
  // 帮他人找回：当前用户是招领发布者且已被认领的记录
  const currentId = currentUser?.sub;
  const helpedOthers = currentId
    ? list.filter((r) => r.type === "found" && r.owner_id === currentId && r.status === "已认领").length
    : Math.floor(recovered * 0.6); // 未登录时显示模拟数据
  // 进行中：待找回 + 待认领
  const active = list.filter((r) => r.status === "待找回" || r.status === "待认领").length;
  // 信用分（不随筛选变化）
  const credit = currentUser ? (currentUser.credit_score || 100) : 100;

  animateNumber("statTotalRecovered", recovered);
  animateNumber("statHelpedOthers", helpedOthers);
  animateNumber("statActiveItems", active);
  animateNumber("statMyCredit", credit);
}

// 数字滚动动画
function animateNumber(elementId, targetValue) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const startValue = parseInt(el.textContent, 10) || 0;
  if (startValue === targetValue) return;

  const duration = 800;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // ease-out-cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(startValue + (targetValue - startValue) * eased);
    el.textContent = current;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ============== 地域筛选渲染 ==============
function renderLocationFilters() {
  const districtSelect = els.filterDistrict;
  const streetSelect = els.filterStreet;
  if (!districtSelect) return;
  const districts = Object.keys(STREET_DATA);
  districtSelect.innerHTML = '<option value="all">全部区</option>' +
    districts.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");
  renderLocationStreets();
}

function renderLocationStreets() {
  const districtSelect = els.filterDistrict;
  const streetSelect = els.filterStreet;
  if (!districtSelect || !streetSelect) return;
  const district = districtSelect.value;
  if (district === "all") {
    streetSelect.innerHTML = '<option value="all">全部街道</option>';
    streetSelect.disabled = true;
    return;
  }
  const streets = STREET_DATA[district] || [];
  streetSelect.innerHTML = '<option value="all">全部街道</option>' +
    streets.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  streetSelect.disabled = false;
}

function bindLocationCascade() {
  const districtSelect = document.querySelector("#districtSelect");
  const streetSelect = document.querySelector("#streetSelect");
  if (!districtSelect || !streetSelect) return;
  districtSelect.addEventListener("change", () => {
    const district = districtSelect.value;
    if (!district) {
      streetSelect.innerHTML = '<option value="">请先选择区</option>';
      return;
    }
    const streets = STREET_DATA[district] || [];
    streetSelect.innerHTML = '<option value="">请选择街道</option>' +
      streets.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  });
}

// ============== 浮动通知 ==============
function showFloatNotify(title, body, actions = []) {
  const host = els.floatNotifyHost;
  if (!host) return;
  const el = document.createElement("div");
  el.className = "float-notify";
  const actionsHtml = actions.map((a) => `<button class="ghost-button" type="button" data-action="${a.id}">${a.label}</button>`).join("");
  el.innerHTML = `
    <div class="float-notify-title">${escapeHtml(title)}</div>
    <div class="float-notify-body">${escapeHtml(body)}</div>
    ${actionsHtml ? `<div class="float-notify-actions">${actionsHtml}</div>` : ""}
  `;
  el.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = actions.find((a) => a.id === btn.dataset.action);
      if (action) action.handler();
      el.classList.add("is-leaving");
      setTimeout(() => el.remove(), 350);
    });
  });
  host.appendChild(el);
  setTimeout(() => {
    if (el.parentNode) {
      el.classList.add("is-leaving");
      setTimeout(() => el.remove(), 350);
    }
  }, 8000);
}

function checkHighMatchAlerts() {
  if (!currentUser) return;
  const myLostRecords = records.filter((r) => r.owner_id === currentUser.sub && r.type === "lost" && r.status !== "已找回");
  if (!myLostRecords.length) return;
  const notifiedKey = "shiyun_notified_matches";
  const notified = new Set(JSON.parse(localStorage.getItem(notifiedKey) || "[]"));
  myLostRecords.forEach((r) => {
    const best = getMatchesFor(r).slice(0, 1)[0];
    if (best && best.result.score >= 75 && !notified.has(r.id)) {
      notified.add(r.id);
      showFloatNotify(
        "🎯 高匹配提醒",
        `你的「${r.title}」可能有匹配线索！匹配度 ${Math.round(best.result.score)}%`,
        [{ id: "view", label: "查看匹配", handler: () => { els.queryRecord.value = r.id; switchView("match"); } }]
      );
    }
  });
  localStorage.setItem(notifiedKey, JSON.stringify([...notified]));
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
  const adminActionsDetail = isAdmin() && !isOwn ? `<button class="danger-button" data-admin-delete-id="${record.id}" type="button">管理员删除</button>` : "";

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

  // 认领区域：非发布者且设置了认领问题时显示
  let claimSection = "";
  if (!isOwn && record.claim_question && !record.claimed_by) {
    claimSection = `<div class="claim-section">
      <div class="claim-question">🔒 认领验证：${escapeHtml(record.claim_question)}</div>
      <input class="claim-answer-input" id="claimAnswer" placeholder="请回答上述问题" />
      <button class="primary-action" id="claimBtn" type="button">申请认领</button>
    </div>`;
  } else if (!isOwn && record.claimed_by) {
    claimSection = `<div class="claim-section"><div class="claim-question">✅ 该物品已被认领</div></div>`;
  }

  // 举报按钮
  const reportLink = !isOwn ? `<button class="report-link" id="reportBtn" type="button">举报该信息</button>` : "";

  // 评价按钮（认领完成后显示）
  let reviewSection = "";
  if (!isOwn && record.claimed_by && currentUser && (record.owner_id === currentUser.sub || record.claimed_by === currentUser.sub)) {
    reviewSection = `<button class="ghost-button" id="reviewBtn" type="button">评价此次交易</button>`;
  }

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
        ${claimSection}
        <div class="contact-section">
          <strong>联系方式：</strong>
          ${contactDisplay}
        </div>
        ${custodyInfo}${institutionInfo}${pickupInfo}
        ${ownActions || adminActionsDetail ? `<div class="card-actions">${ownActions}${adminActionsDetail}</div>` : ""}
        ${reviewSection}
        <div style="text-align:right;margin-top:8px;">${reportLink}</div>
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
  els.detailContent.querySelectorAll("[data-admin-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (confirm("管理员确认删除此记录？")) deleteRecord(btn.dataset.adminDeleteId);
    });
  });
  els.detailContent.querySelectorAll(".verify-trigger").forEach((btn) => {
    btn.addEventListener("click", () => { els.detailDialog.close(); els.verifyDialog.showModal(); });
  });
  els.detailContent.querySelectorAll(".view-contact-btn").forEach((btn) => {
    btn.addEventListener("click", () => showContactPrompt());
  });
  // 认领按钮
  const claimBtn = els.detailContent.querySelector("#claimBtn");
  if (claimBtn) {
    claimBtn.addEventListener("click", () => {
      const answer = els.detailContent.querySelector("#claimAnswer")?.value?.trim();
      if (!answer) { showToast("请回答问题", "error"); return; }
      handleClaimRequest(record.id, answer);
    });
  }
  // 举报按钮
  const reportBtn = els.detailContent.querySelector("#reportBtn");
  if (reportBtn) {
    reportBtn.addEventListener("click", () => {
      if (!confirm("确定举报该信息吗？恶意举报会影响您的信用分。")) return;
      handleReport(record.id);
    });
  }
  // 评价按钮
  const reviewBtn = els.detailContent.querySelector("#reviewBtn");
  if (reviewBtn) {
    reviewBtn.addEventListener("click", () => openReviewDialog(record.id));
  }
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
    els.notifyList.innerHTML = `<div class="empty-state"><strong>暂无消息</strong><p>发布信息后，系统会自动推送匹配线索和动态通知</p></div>`;
    return;
  }
  els.notifyList.innerHTML = notifications.map((n) => {
    let actions = "";
    if (n.type === "claim_request" && n.related_record_id) {
      // 从通知body中提取claim_id，格式为 "claim_id:xxx"
      const claimIdMatch = (n.body || "").match(/claim_id:([a-zA-Z0-9_]+)/);
      const claimId = claimIdMatch ? claimIdMatch[1] : n.id;
      actions = `<div style="margin-top:8px;display:flex;gap:8px;">
        <button class="ghost-button" type="button" data-claim="approve" data-claim-id="${escapeHtml(claimId)}" data-record="${escapeHtml(n.related_record_id)}">同意</button>
        <button class="ghost-button" type="button" data-claim="reject" data-claim-id="${escapeHtml(claimId)}" data-record="${escapeHtml(n.related_record_id)}">拒绝</button>
      </div>`;
    }
    return `<div class="notify-item${n.is_read ? " is-read" : ""}">
      <div class="notify-title">${escapeHtml(n.title)}</div>
      <div class="notify-body">${escapeHtml(n.body || "")}</div>
      <div class="notify-time">${formatTime(n.created_at)}</div>
      ${actions}
    </div>`;
  }).join("");

  // 绑定认领审核按钮
  els.notifyList.querySelectorAll("[data-claim]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const status = btn.dataset.claim;
      const claimId = btn.dataset.claimId;
      if (!claimId) { showToast("无法获取认领申请ID", "error"); return; }
      try {
        const resp = await fetch(`/api/records?action=review-claim`, {
          method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ claim_id: claimId, status }),
        });
        const data = await resp.json();
        if (data.ok) {
          showToast(status === "approved" ? "已同意认领申请" : "已拒绝认领申请", "success");
          btn.parentElement.remove();
        } else {
          showToast(data.error || "操作失败", "error");
        }
      } catch (e) { showToast("操作失败", "error"); }
    });
  });
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
  const level = currentUser.level || 1;
  const exp = currentUser.exp || 0;
  const nextExp = Math.pow(level, 2) * 100;
  const title = LEVEL_TITLES[level] || "拾遗新手";
  const badges = currentUser.badges || ["🌱 新手上路"];
  const creditScore = currentUser.credit_score || (verified ? 10 : 5);
  const totalPublished = currentUser.total_published || 0;
  const totalHelped = currentUser.total_helped || 0;
  const streak = currentUser.streak_days || 0;

  const verifySection = verified
    ? `<div class="verify-status verified"><span>✅ 已完成实名认证</span><small>您可以查看完整联系方式</small></div>`
    : `<div class="verify-status unverified"><span>⚠️ 未实名认证</span><small>认证后可查看完整联系方式</small></div>
       <button class="primary-action" onclick="document.querySelector('#verifyDialog').showModal()">完成实名认证</button>`;

  const myRecords = records.filter((r) => r.owner_id === currentUser.sub);
  const myRecordsHtml = myRecords.length
    ? `<div class="my-records-list">${myRecords.map((r) => renderRecordCard(r)).join("")}</div>`
    : `<div class="empty-state"><strong>暂无发布记录</strong><p>你还没有发布过任何信息，去发布第一条吧</p><button class="primary-action" onclick="switchView('publish')" style="margin-top:8px;">去发布一条</button></div>`;

  els.profileContent.innerHTML = `
    <div class="profile-card">
      <div class="profile-avatar">${escapeHtml((currentUser.nickname || "?")[0])}</div>
      <div class="profile-info">
        <h3>${escapeHtml(currentUser.nickname || "无名氏")}</h3>
        <p>${verified ? "✅ 已实名认证" : "⚠️ 未实名认证"}</p>
        <p>登录方式：${currentUser.provider === "wechat_mock" ? "微信" : "游客"}</p>
      </div>
    </div>
    <div class="user-status-bar" style="margin:16px 0;">
      <span class="status-avatar">${escapeHtml((currentUser.nickname || "?")[0])}</span>
      <div style="display:flex;flex-direction:column;gap:2px;">
        <span class="status-level">Lv.${level} ${title}</span>
        <span class="status-exp">EXP ${exp}/${nextExp} · 连续 ${streak} 天</span>
      </div>
      <span style="font-size:12px;color:var(--text2);margin-left:auto;">已帮助 ${totalHelped} 人</span>
    </div>
    <div class="profile-stats">
      <div class="metric-card"><strong>信用积分</strong><span>${creditScore}</span></div>
      <div class="metric-card"><strong>发布数</strong><span>${totalPublished}</span></div>
      <div class="metric-card"><strong>徽章</strong><span>${badges.length}</span></div>
    </div>
    <div class="profile-badges">
      <h4>我的徽章</h4>
      <div class="badge-list">${badges.map((b) => `<span class="badge-item" data-rarity="${BADGE_RARITY[b] || 'common'}">${b}</span>`).join("")}</div>
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
  renderAll();
  showToast("已退出当前账号", "info");
}

// ============== 多账号管理 ==============
function getAccounts() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]"); } catch { return []; }
}
function saveAccounts(list) { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list)); }

function addAccount(token, user) {
  const list = getAccounts().filter(a => a.id !== user.sub);
  list.unshift({ id: user.sub, nickname: user.nickname, token, avatar: user.avatar_url || "" });
  saveAccounts(list);
}

function switchAccount(accountId) {
  const acc = getAccounts().find(a => a.id === accountId);
  if (!acc) return false;
  localStorage.setItem(AUTH_TOKEN_KEY, acc.token);
  const jwtPayload = decodeJwtPayload(acc.token);
  // 切换账号时仅从JWT获取基础信息；JWT的exp是过期时间戳，不能作为经验值
  // 经验值先设为0，后续通过/api/auth?action=me或add-exp刷新
  currentUser = { ...jwtPayload, exp: 0 };
  updateAuthUI();
  renderAll();
  showToast(`已切换到 ${acc.nickname}`, "success");
  return true;
}

function removeAccount(accountId) {
  const list = getAccounts().filter(a => a.id !== accountId);
  saveAccounts(list);
  if (currentUser && currentUser.sub === accountId) {
    handleLogout();
  }
}

function renderAccountList() {
  const container = document.getElementById("accountList");
  if (!container) return;
  const accounts = getAccounts();
  const currentId = currentUser?.sub;
  container.innerHTML = accounts.map(a => `
    <div class="account-item ${a.id === currentId ? 'is-current' : ''}" data-account-id="${escapeHtml(a.id)}">
      <span class="acc-avatar">${a.avatar ? `<img src="${escapeHtml(a.avatar)}" style="width:100%;height:100%;border-radius:50%">` : '👤'}</span>
      <span class="acc-name">${escapeHtml(a.nickname)} ${a.id === currentId ? '<span style="color:var(--primary);font-size:12px">当前</span>' : ''}</span>
      <span class="acc-remove" data-remove-id="${escapeHtml(a.id)}">移除</span>
    </div>
  `).join("");

  container.querySelectorAll(".account-item").forEach(el => {
    el.addEventListener("click", (e) => {
      if (e.target.classList.contains("acc-remove")) {
        const id = e.target.dataset.removeId;
        removeAccount(id);
        renderAccountList();
        return;
      }
      const id = el.dataset.accountId;
      if (id !== currentId) {
        switchAccount(id);
        renderAccountList();
      }
    });
  });

  // 绑定"添加新账号"按钮
  const addBtn = document.getElementById("addAccountBtn");
  if (addBtn) {
    addBtn.onclick = () => {
      document.querySelector("#userDialog")?.close();
      els.loginDialog?.showModal();
    };
  }
}

function isAdmin() { return currentUser?.role === "admin"; }

// ============== 图片上传 ==============
async function handleImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  await processUploadedImage(file);
}

async function processUploadedImage(file) {
  if (!file.type.startsWith("image/")) { renderUploadMessage("请选择图片文件。"); return; }
  try {
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
  } catch (e) {
    renderUploadMessage("图片处理失败，请重试或换一张图片。");
    uploadedImageData = "";
    uploadedImageUrl = "";
    uploadedFeature = null;
    uploadedSemantic = null;
  }
}

function renderUploadMessage(message) {
  els.featurePreview.innerHTML = `<strong>图像特征与语义识别</strong><p>${escapeHtml(message)}</p>`;
}

function renderFeaturePreview(feature, semantic, statusText = "") {
  if (!feature) {
    els.featurePreview.innerHTML = `<strong>图像特征提取失败</strong><p>${escapeHtml(statusText || "无法解析图像特征，请尝试更换图片。")}</p>`;
    return;
  }
  const colors = (feature.palette || []).slice(0, 5).map((rgb) => `<span class="swatch" style="background:rgb(${rgb.join(",")})"></span>`).join("");
  const semanticHtml = semantic
    ? `<p>语义结果：${escapeHtml(semantic.object_name)} · ${escapeHtml(semantic.category)} · 置信度 ${Math.round((semantic.confidence || 0) * 100)}%<br/>特征：${escapeHtml((semantic.features || []).slice(0, 4).join("、") || "暂无")}</p>`
    : `<p>${escapeHtml(statusText || "未获得语义识别结果，将使用本地图像特征匹配。")}</p>`;
  els.featurePreview.innerHTML = `<strong>图像特征已提取</strong>
    <p>主色 RGB：${(feature.dominantColor || []).join(", ")}<br/>感知哈希：${(feature.hash || "").slice(0, 16)}...</p>
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
    const locationParts = [data.district, data.street, data.detail_location].filter(Boolean);
    const newRecord = {
      id: `record-${Date.now()}`, type: data.type, title: data.title.trim(),
      category: data.category, color: data.color,
      city: data.city || "上海市", district: data.district || "", street: data.street || "",
      detail_location: data.detail_location || "",
      location: locationParts.join(" ") || data.district || "",
      time: data.time, contact: data.contact.trim(), description: data.description.trim(),
      status: data.type === "lost" ? "待找回" : "待认领",
      item_status: data.item_status || "unknown",
      custody_point_id: data.custody_point_id || "",
      owner_id: currentUser?.sub || "",
      claim_question: data.claim_question?.trim() || "",
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

    // 增加经验值和徽章
    let bestMatch = null;
    if (currentUser) {
      try {
        bestMatch = getBestMatch(newRecord);
        const expResp = await fetch("/api/auth?action=add-exp", {
          method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ delta: 10, action: "publish" }),
        });
        const expData = await expResp.json();
        if (expData.user) {
          // 显式保留经验值字段，防止后端返回的user对象中exp被JWT exp覆盖
          currentUser = { ...currentUser, ...expData.user, exp: expData.user.exp ?? currentUser.exp ?? 0 };
          if (expData.levelUp) {
            showAchievementPopup("level_up", `升级啦！Lv.${expData.newLevel} ${LEVEL_TITLES[expData.newLevel] || "拾遗新手"}`);
          }
        }
        // 首次发布徽章
        const totalPublished = currentUser.total_published || 0;
        if (totalPublished === 1) {
          await unlockBadge("first_publish");
        }
        // 匹配达人徽章
        if (bestMatch && bestMatch.score >= 80) {
          await unlockBadge("match_master");
        }
        // 城市守护者徽章
        if ((currentUser.level || 1) >= 7) {
          await unlockBadge("guardian");
        }
      } catch (e) { /* 静默 */ }
    }

    resetPublishForm();
    renderAll();
    els.queryRecord.value = newRecord.id;
    switchView("match");

    // 匹配成功时推送通知
    if (!bestMatch) bestMatch = getBestMatch(newRecord);
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

  // 填充结构化地点字段
  const districtSelect = form.querySelector('select[name="district"]');
  const streetSelect = form.querySelector('select[name="street"]');
  const detailInput = form.querySelector('input[name="detail_location"]');
  if (districtSelect && record.district) {
    setSelectValue(districtSelect, record.district);
    districtSelect.dispatchEvent(new Event("change"));
  }
  if (streetSelect && record.street) {
    setTimeout(() => { setSelectValue(streetSelect, record.street); }, 50);
  }
  if (detailInput) {
    detailInput.value = record.detail_location || "";
  }

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

    const locationParts = [data.district, data.street, data.detail_location].filter(Boolean);
    const updatePayload = {
      id: editingRecordId,
      title: data.title.trim(),
      category: data.category,
      color: data.color,
      location: locationParts.join(" ") || data.district || data.location,
      time: data.time,
      contact: data.contact.trim(),
      description: data.description.trim(),
      image_data: imageData,
      image_feature: imageFeature,
      semantic: semantic,
      city: data.city || "上海市",
      district: data.district || "",
      street: data.street || "",
      detail_location: data.detail_location || "",
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
  // 前端已按权限条件渲染按钮，此处仅做兜底校验
  if (!isOwnRecord(record) && !isAdmin()) return;
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
  // 防御无效日期值
  if (!value || value === "未知时间") return "未知时间";
  try {
    const d = new Date(value);
    // 检查日期是否有效
    if (isNaN(d.getTime())) return String(value);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch (e) { return String(value); }
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
  if (seed.shape === "bag") drawBag(ctx, seed);
  if (seed.shape === "jewelry") drawJewelry(ctx, seed);
  if (seed.shape === "book") drawBook(ctx, seed);
  if (seed.shape === "tablet") drawTablet(ctx, seed);
  return canvas.toDataURL("image/png");
}

function drawCard(ctx, s) { roundRect(ctx, 145, 130, 350, 220, 28); ctx.fill(); ctx.stroke(); ctx.fillStyle = s.secondary; roundRect(ctx, 190, 184, 160, 20, 10); ctx.fill(); roundRect(ctx, 190, 232, 240, 18, 9); ctx.fill(); ctx.fillStyle = "#e9a227"; ctx.beginPath(); ctx.arc(446, 168, 22, 0, Math.PI * 2); ctx.fill(); }
function drawEarbud(ctx, s) { roundRect(ctx, 190, 185, 260, 150, 54); ctx.fill(); ctx.stroke(); ctx.fillStyle = s.secondary; ctx.beginPath(); ctx.arc(260, 255, 24, 0, Math.PI * 2); ctx.arc(380, 255, 24, 0, Math.PI * 2); ctx.fill(); }
function drawUmbrella(ctx, s) { ctx.beginPath(); ctx.arc(320, 250, 150, Math.PI, 0); ctx.lineTo(170, 250); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = s.secondary; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(320, 250); ctx.lineTo(320, 345); ctx.quadraticCurveTo(320, 390, 370, 370); ctx.stroke(); }
function drawKey(ctx, s) { ctx.beginPath(); ctx.arc(230, 250, 62, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = s.background; ctx.beginPath(); ctx.arc(230, 250, 28, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = s.primary; roundRect(ctx, 280, 232, 210, 36, 18); ctx.fill(); ctx.fillRect(420, 268, 28, 52); ctx.fillRect(462, 268, 28, 36); }
function drawCup(ctx, s) { roundRect(ctx, 230, 120, 180, 245, 36); ctx.fill(); ctx.stroke(); ctx.strokeStyle = s.secondary; ctx.beginPath(); ctx.arc(416, 230, 52, -Math.PI / 2, Math.PI / 2); ctx.stroke(); }
function drawBag(ctx, s) {
  // 包身：圆角矩形
  roundRect(ctx, 220, 160, 200, 180, 28);
  ctx.fill();
  ctx.stroke();
  // 半圆形提手
  ctx.strokeStyle = s.secondary;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(320, 160, 50, Math.PI, 0);
  ctx.stroke();
  // 两条肩带线条
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(240, 170);
  ctx.lineTo(200, 100);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(400, 170);
  ctx.lineTo(440, 100);
  ctx.stroke();
}
function drawJewelry(ctx, s) {
  // 手链主体：圆环
  ctx.lineWidth = 10;
  ctx.strokeStyle = s.primary;
  ctx.beginPath();
  ctx.arc(320, 240, 90, 0, Math.PI * 2);
  ctx.stroke();
  // 圆环上的小圆点装饰
  ctx.fillStyle = s.secondary;
  const dots = 6;
  for (let i = 0; i < dots; i++) {
    const angle = (Math.PI * 2 * i) / dots;
    const x = 320 + Math.cos(angle) * 90;
    const y = 240 + Math.sin(angle) * 90;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  // 吊坠：底部小圆
  ctx.fillStyle = s.primary;
  ctx.beginPath();
  ctx.arc(320, 360, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = s.secondary;
  ctx.lineWidth = 4;
  ctx.stroke();
}
function drawBook(ctx, s) {
  // 书本：竖向圆角矩形
  roundRect(ctx, 250, 110, 140, 260, 16);
  ctx.fill();
  ctx.stroke();
  // 书脊：左侧竖线
  ctx.strokeStyle = s.secondary;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(278, 110);
  ctx.lineTo(278, 370);
  ctx.stroke();
  // 文字横线
  ctx.strokeStyle = s.secondary;
  ctx.lineWidth = 5;
  for (let i = 0; i < 5; i++) {
    const y = 160 + i * 36;
    ctx.beginPath();
    ctx.moveTo(300, y);
    ctx.lineTo(370, y);
    ctx.stroke();
  }
}
function drawTablet(ctx, s) {
  // 平板主体：大圆角矩形
  roundRect(ctx, 170, 130, 300, 220, 24);
  ctx.fill();
  ctx.stroke();
  // 屏幕：内框细线
  ctx.strokeStyle = s.secondary;
  ctx.lineWidth = 3;
  roundRect(ctx, 190, 150, 260, 180, 16);
  ctx.stroke();
  // Home 键：底部小圆点
  ctx.fillStyle = s.secondary;
  ctx.beginPath();
  ctx.arc(320, 330, 10, 0, Math.PI * 2);
  ctx.fill();
}
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

// ============== 成就系统 ==============
function showAchievementPopup(type, message, badgeEmoji = "") {
  const host = els.floatNotifyHost;
  if (!host) return;
  const el = document.createElement("div");
  el.className = "float-notify";
  el.style.borderLeftColor = "var(--orange)";
  const shareBtn = type === "badge" ? `<button class="ghost-button" type="button" data-action="share">分享到朋友圈</button>` : "";
  el.innerHTML = `
    <div class="float-notify-title">🏆 ${escapeHtml(message)}</div>
    ${badgeEmoji ? `<div style="font-size:32px;text-align:center;margin:8px 0;">${badgeEmoji}</div>` : ""}
    <div class="float-notify-actions">${shareBtn}<button class="ghost-button" type="button" data-action="close">知道了</button></div>
  `;
  el.querySelector("[data-action='close']")?.addEventListener("click", () => { el.classList.add("is-leaving"); setTimeout(() => el.remove(), 350); });
  el.querySelector("[data-action='share']")?.addEventListener("click", () => { shareAchievement(type, message); el.classList.add("is-leaving"); setTimeout(() => el.remove(), 350); });
  host.appendChild(el);
  setTimeout(() => { if (el.parentNode) { el.classList.add("is-leaving"); setTimeout(() => el.remove(), 350); } }, 6000);
}

function shareAchievement(type, message) {
  const badgeEmoji = type === "badge" ? "🏆" : type === "level_up" ? "🎉" : "✨";
  const text = `${badgeEmoji} 我在【拾寻】城市失物招领平台达成了成就：${message}！\n\n💙 每一份善意都让城市更温暖\n🤝 快来一起帮助失物回到主人身边\n👇 ${window.location.href}`;
  if (navigator.share) {
    navigator.share({ title: "拾寻成就", text }).catch(() => {
      copyToClipboard(text);
      showToast("已复制分享内容到剪贴板", "success");
    });
  } else {
    copyToClipboard(text);
    showToast("已复制分享内容到剪贴板", "success");
  }
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  });
}

async function unlockBadge(badgeKey) {
  if (!currentUser) return;
  try {
    const resp = await fetch("/api/auth?action=unlock-badge", {
      method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ badge: badgeKey }),
    });
    const data = await resp.json();
    if (data.badgeLabel && !data.alreadyHad) {
      const BADGE_EMOJI = { first_publish: "📝", match_master: "🎯", helper: "🤝", streak7: "🔥", guardian: "🏆" };
      currentUser = { ...currentUser, badges: data.user?.badges || currentUser.badges };
      showAchievementPopup("badge", `解锁新徽章：${data.badgeLabel}`, BADGE_EMOJI[badgeKey] || "🏆");
    }
  } catch (e) { /* 静默 */ }
}

async function checkUserStreak() {
  if (!currentUser) return;
  try {
    const resp = await fetch("/api/auth?action=check-streak", {
      method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
    });
    const data = await resp.json();
    if (data.unlockedStreakBadge) {
      showAchievementPopup("badge", "解锁新徽章：🔥 连续活跃", "🔥");
    }
  } catch (e) { /* 静默 */ }
}

function renderUserStatusBar() {
  const bar = els.userStatusBar;
  if (!bar) return;
  if (!currentUser) {
    bar.innerHTML = `<span class="status-avatar">?</span><span class="status-level">登录后解锁成长体系</span>`;
    bar.style.display = "flex";
    return;
  }
  const level = currentUser.level || 1;
  const exp = currentUser.exp || 0;
  const nextExp = Math.pow(level, 2) * 100;
  const title = LEVEL_TITLES[level] || "拾遗新手";
  const badges = currentUser.badges || [];
  bar.innerHTML = `
    <span class="status-avatar">${escapeHtml((currentUser.nickname || "?")[0])}</span>
    <span class="status-level">Lv.${level} ${title}</span>
    <span class="status-exp">EXP ${exp}/${nextExp}</span>
    <span class="status-badges">${badges.slice(0, 3).map((b) => `<span class="badge-item" data-rarity="${BADGE_RARITY[b] || 'common'}" style="padding:2px 6px;font-size:11px;">${b}</span>`).join("")}</span>
  `;
  bar.style.display = "flex";
}

// ============== 认领/评价/举报交互 ==============
async function handleClaimRequest(recordId, answer) {
  if (!currentUser) { showToast("请先登录", "error"); return; }
  try {
    const resp = await fetch("/api/records?action=claim-request", {
      method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ record_id: recordId, answer }),
    });
    const data = await resp.json();
    if (data.ok) {
      showToast("认领申请已提交，等待发布者审核", "success");
      els.detailDialog?.close();
    } else {
      showToast(data.error || "提交失败", "error");
    }
  } catch (e) { showToast("提交失败", "error"); }
}

async function handleReport(recordId) {
  if (!currentUser) { showToast("请先登录", "error"); return; }
  try {
    const resp = await fetch("/api/records?action=report", {
      method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ record_id: recordId, reason: "用户举报" }),
    });
    const data = await resp.json();
    if (data.ok) {
      showToast("举报已提交", "success");
    } else {
      showToast(data.error || "举报失败", "error");
    }
  } catch (e) { showToast("举报失败", "error"); }
}

function openReviewDialog(recordId) {
  // 动态创建评价弹窗内容
  const dialog = document.createElement("dialog");
  dialog.className = "detail-dialog";
  dialog.innerHTML = `
    <div class="detail-content" style="padding:24px;">
      <h3>评价此次交易</h3>
      <div class="review-stars" id="reviewStars">
        <span class="star" data-val="1">⭐</span>
        <span class="star" data-val="2">⭐</span>
        <span class="star" data-val="3">⭐</span>
        <span class="star" data-val="4">⭐</span>
        <span class="star" data-val="5">⭐</span>
      </div>
      <textarea class="review-comment" id="reviewComment" rows="3" placeholder="写下您的评价（选填）"></textarea>
      <div style="display:flex;gap:10px;margin-top:16px;">
        <button class="primary-action" id="submitReviewBtn" type="button">提交评价</button>
        <button class="ghost-button" id="cancelReviewBtn" type="button">取消</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.showModal();

  let selectedRating = 0;
  const stars = dialog.querySelectorAll(".star");
  stars.forEach((star) => {
    star.addEventListener("click", () => {
      selectedRating = parseInt(star.dataset.val, 10);
      stars.forEach((s, i) => s.classList.toggle("is-active", i < selectedRating));
    });
  });

  dialog.querySelector("#cancelReviewBtn").addEventListener("click", () => dialog.close());
  dialog.querySelector("#submitReviewBtn").addEventListener("click", async () => {
    if (!selectedRating) { showToast("请选择评分", "error"); return; }
    try {
      const resp = await fetch("/api/records?action=submit-review", {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ record_id: recordId, rating: selectedRating, comment: dialog.querySelector("#reviewComment").value.trim() }),
      });
      const data = await resp.json();
      if (data.ok) {
        showToast("评价已提交", "success");
        dialog.close();
      } else {
        showToast(data.error || "评价失败", "error");
      }
    } catch (e) { showToast("评价失败", "error"); }
  });
  dialog.addEventListener("close", () => dialog.remove());
}

// ============== 互动角色：拾小寻 ==============
const MASCOT_TIPS = {
  home: [
    "👋 你好！我是拾小寻，有什么可以帮你的吗？",
    "💡 小提示：发布信息时尽量描述详细，匹配更准确哦！",
    "🔍 在搜索框输入关键词，可以快速找到相关失物~",
  ],
  publish: [
    "📝 填写详细信息能帮助失主更快找回物品！",
    "📸 上传图片可以让匹配更准确哦~",
    "🗺️ 地点选到街道级别，附近的人更容易看到！",
  ],
  match: [
    "🤖 AI 会综合颜色、地点、时间等多个维度为你匹配！",
    "📷 上传图片进行以图搜图，找东西更高效~",
  ],
  notify: [
    "🔔 有新消息会在这里通知你哦~",
    "📬 记得及时查看认领申请！",
  ],
  profile: [
    "🏅 多发布、多帮助，就能升级解锁更多徽章！",
    "✨ 连续登录可以获得🔥连续活跃徽章哦~",
  ],
  stats: [
    "📊 数据见证温暖，每一份善意都被记录~",
  ],
  unverified: [
    "🔒 实名认证后可以查看完整联系方式哦~",
    "🆔 点击右上角【实名认证】完成身份验证吧！",
  ],
  guest: [
    "👤 登录后可以发布信息和查看联系方式~",
    "🚀 快来登录体验完整功能吧！",
  ],
};

// 拾小寻 FAQ 数据
const MASCOT_FAQ = [
  { q: "拾寻是什么？", a: "拾寻是一个基于 AI 智能匹配的城市失物招领平台，帮助失主和拾主快速精准对接。" },
  { q: "如何发布失物/招领信息？", a: "点击首页右上角【发布】按钮，填写物品特征、地点、时间等信息，AI 还可以帮你自动提取文字描述哦！" },
  { q: "AI 匹配是怎么工作的？", a: "系统会从类别、颜色、地点、时间、文本语义等多个维度计算匹配度，给出 0-100% 的匹配分数。" },
  { q: "如何申请认领物品？", a: "在匹配结果中找到高匹配度的记录，点击【认领申请】，回答发布者设置的问题，等待审核通过即可。" },
  { q: "信用分是什么？", a: "信用分是拾寻的信誉体系：好评+10分，差评-5分，被举报核实-20分。信用分越高，越容易被信任。" },
  { q: "实名认证有什么用？", a: "实名认证后信用分提升至 10 分，可以查看完整联系方式，让交易更放心。" },
  { q: "我的隐私安全吗？", a: "拾寻仅在认领审核通过后向双方展示联系方式，平时信息脱敏展示，保护用户隐私。" },
  { q: "如何获得徽章？", a: "通过发布信息、帮助匹配、连续活跃等行为可以解锁徽章，比如【初次发布】【匹配达人】【助人为乐】等。" },
];

let mascotTimer = null;
let mascotTipIndex = 0;
let mascotFaqOpen = false;

function initMascot() {
  const avatar = document.getElementById("mascotAvatar");
  const bubble = document.getElementById("mascotBubble");
  const closeBtn = document.getElementById("mascotClose");
  if (!avatar || !bubble) return;

  // 渲染 FAQ 列表
  renderMascotFaq();

  // 点击头像切换气泡显示/隐藏
  avatar.addEventListener("click", () => {
    const isVisible = bubble.classList.contains("is-visible");
    if (isVisible) {
      bubble.classList.remove("is-visible");
      clearInterval(mascotTimer);
      mascotTimer = null;
    } else {
      refreshMascotTip();
      bubble.classList.add("is-visible");
      startMascotRotation();
    }
  });

  // 关闭按钮
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      bubble.classList.remove("is-visible");
      clearInterval(mascotTimer);
      mascotTimer = null;
    });
  }

  // 点击气泡外部自动关闭
  document.addEventListener("click", (e) => {
    if (!bubble.classList.contains("is-visible")) return;
    if (!avatar.contains(e.target) && !bubble.contains(e.target)) {
      bubble.classList.remove("is-visible");
      clearInterval(mascotTimer);
      mascotTimer = null;
    }
  });

  // 不再自动弹出气泡，仅保留头像可见，由用户主动点击展开
}

function renderMascotFaq() {
  const list = document.getElementById("mascotFaqList");
  if (!list) return;
  list.innerHTML = MASCOT_FAQ.map((item, idx) => `
    <div class="mascot-faq-item" data-faq-idx="${idx}">
      <div class="mascot-faq-q">❓ ${escapeHtml(item.q)}</div>
      <div class="mascot-faq-a">${escapeHtml(item.a)}</div>
    </div>
  `).join("");

  list.querySelectorAll(".mascot-faq-item").forEach(el => {
    el.addEventListener("click", () => {
      const isOpen = el.classList.contains("is-open");
      list.querySelectorAll(".mascot-faq-item").forEach(i => i.classList.remove("is-open"));
      if (!isOpen) el.classList.add("is-open");
    });
  });
}

function showMascotTip(text) {
  const tipEl = document.getElementById("mascotTipText");
  if (tipEl) tipEl.textContent = text;
}

function refreshMascotTip() {
  const view = document.querySelector(".view.is-active")?.id?.replace("view-", "") || "home";
  let pool = MASCOT_TIPS[view] || MASCOT_TIPS.home;
  if (!currentUser) {
    pool = pool.concat(MASCOT_TIPS.guest);
  } else if (!currentUser.verified) {
    pool = pool.concat(MASCOT_TIPS.unverified);
  }
  const idx = Math.floor(Math.random() * pool.length);
  showMascotTip(pool[idx]);
}

function startMascotRotation() {
  if (mascotTimer) clearInterval(mascotTimer);
  mascotTimer = setInterval(() => {
    refreshMascotTip();
  }, 6000);
}

function stopMascotRotation() {
  if (mascotTimer) {
    clearInterval(mascotTimer);
    mascotTimer = null;
  }
}

// 视图切换时更新拾小寻提示
const originalSwitchView = switchView;
switchView = function(view) {
  originalSwitchView(view);
  const bubble = document.getElementById("mascotBubble");
  if (bubble && bubble.classList.contains("is-visible")) {
    refreshMascotTip();
  }
};
