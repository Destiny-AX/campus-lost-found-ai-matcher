"use strict";

// ============================================================
// 拾寻 v3 — 城市拾遗网络 前端核心逻辑
// ============================================================

// ============== 常量与配置 ==============
const WEIGHTS = { category: 0.13, color: 0.08, location: 0.14, time: 0.11, text: 0.14, image: 0.2, semantic: 0.2 };
const DIMENSION_LABELS = { category: "类别", color: "颜色", location: "地点", time: "时间", text: "文本", image: "图像", semantic: "语义" };
let runtimeDataSource = "detecting";
let matchRenderNonce = 0;

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
let recordsLoadState = { status: "loading", error: "" };
let activeFilter = "all";
let activeCategory = "all"; // 当前选中的类别筛选
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
  // 默认不设置固定筛选条件，显示全部记录
  // 如需示例筛选，可通过URL参数或localStorage恢复用户上次的选择
  const savedDistrict = localStorage.getItem('lastDistrict');
  const savedStreet = localStorage.getItem('lastStreet');
  if (els.filterDistrict && savedDistrict) {
    els.filterDistrict.value = savedDistrict;
    if (els.filterDistrictInput) els.filterDistrictInput.value = savedDistrict;
    renderLocationStreets();
    if (els.filterStreet && savedStreet) {
      els.filterStreet.value = savedStreet;
      if (els.filterStreetInput) els.filterStreetInput.value = savedStreet;
    }
  }
  renderAll();
  await prepareVerificationView();
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

async function prepareVerificationView() {
  const mode = new URLSearchParams(window.location.search).get("verify_view");
  if (!mode) return;
  document.body.dataset.verifyView = mode;
  if (!currentUser) await autoLoginDemo();
  if (mode === "home") { switchView("home"); return; }
  if (mode === "publish" || mode === "degraded") {
    switchView("publish");
    els.aiInput.value = "昨晚在中国传媒大学图书馆丢了一个黑色 AirPods Pro，充电盒有一道划痕。";
    await handleAiExtract();
    return;
  }
  if (mode === "image") {
    switchView("publish");
    return;
  }
  if (mode === "match") {
    switchView("match");
    await renderMatchView();
    return;
  }
  if (mode === "privacy") {
    switchView("home");
    const found = records.find((record) => record.type === "found" && record.is_fuzzy);
    if (found) openDetail(found.id);
    return;
  }
  if (mode === "evaluation") { switchView("stats"); }
}
// ============== DOM 缓存 ==============
function cacheElements() {
  const ids = [
    "itemList", "searchInput", "categoryFilter", "queryRecord", "selectedRecord",
    "matchResults", "publishForm", "imageInput", "dropZone", "imagePreview",
    "featurePreview", "metricGrid", "detailDialog", "detailContent",
    "closeDialog", "topAuthBtn", "topVerifyBtn", "mobileAuthBtn", "mobileVerifyBtn",
    "loginDialog", "loginForm", "loginGuestBtn", "closeLoginBtn",
    "verifyDialog", "verifyForm", "closeVerifyBtn", "verifyError",
    "pickupDialog", "pickupForm", "closePickupBtn",
    "aiInput", "aiExtractBtn", "aiExtractHint", "fieldConfidencePanel", "fieldConfidenceList",
    "extractionSourceNotice", "extractionSourceBadge", "aiFieldConfirmation", "confirmExtractedFields",
    "aiProcessingPanel", "aiProcessingGrid",
    "itemStatusGroup", "custodyPicker", "custodyPointSelect", "claimQuestionGroup",
    "notifyList", "markAllReadBtn", "refreshNotifyBtn", "notifyBadge", "notifyBadgeMobile",
    "profileContent", "toastHost", "floatNotifyHost", "userStatusBar",
    "filterDistrict", "filterStreet",
    "filterDistrictInput", "filterDistrictList",
    "filterStreetInput", "filterStreetList",
    "queryRecordInput", "queryRecordList",
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

  // 筛选（顶部 type filter：失物/招领/全部/官方）
  document.querySelectorAll(".filter-group [data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      document.querySelectorAll(".filter-group [data-filter]").forEach((c) => c.classList.remove("is-active"));
      btn.classList.add("is-active");
      // 类型切换时，重置类别筛选为"全部"并动态更新可选项
      activeCategory = "all";
      document.querySelectorAll("#filterChips .filter-chip").forEach((c) => c.classList.remove("is-active"));
      const allChip = document.querySelector('#filterChips .filter-chip[data-filter="all"]');
      if (allChip) allChip.classList.add("is-active");
      renderCategoryChips();
      renderItemList();
    });
  });

  // 类别 chip 筛选
  document.querySelectorAll("#filterChips .filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const val = chip.dataset.filter;
      activeCategory = val;
      // 更新 chip 视觉状态
      document.querySelectorAll("#filterChips .filter-chip").forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      renderItemList();
    });
  });

  on(els.searchInput, "input", renderItemList);
  on(els.filterDistrict, "change", () => {
    localStorage.setItem('lastDistrict', els.filterDistrict.value);
    renderLocationStreets();
    renderItemList();
  });
  on(els.filterStreet, "change", () => {
    localStorage.setItem('lastStreet', els.filterStreet.value);
    renderItemList();
  });
  on(els.queryRecord, "change", renderMatchView);

  // 初始化可搜索下拉组件
  initSearchSelect({
    input: els.filterDistrictInput,
    list: els.filterDistrictList,
    select: els.filterDistrict,
    options: () => Object.keys(STREET_DATA),
    placeholder: "北京市 - 全部区",
    onSelect: () => { renderLocationStreets(); renderItemList(); },
  });
  initSearchSelect({
    input: els.filterStreetInput,
    list: els.filterStreetList,
    select: els.filterStreet,
    options: () => {
      const district = els.filterDistrict?.value;
      return district && district !== "all" ? STREET_DATA[district] || [] : [];
    },
    placeholder: "全部街道",
    onSelect: renderItemList,
  });
  initSearchSelect({
    input: els.queryRecordInput,
    list: els.queryRecordList,
    select: els.queryRecord,
    options: () => records.map((r) => ({ value: r.id, label: `${r.type === "lost" ? "寻物" : "招领"}｜${r.title}` })),
    placeholder: "选择待匹配信息...",
    onSelect: renderMatchView,
  });
  on(els.imageInput, "change", handleImageUpload);
  bindDropUpload();
  on(els.publishForm, "submit", handlePublish);
  on(els.closeDialog, "click", () => els.detailDialog?.close());

  // 登录按钮事件在 updateAuthUI 中动态绑定
  on(els.closeLoginBtn, "click", () => els.loginDialog?.close());
  on(els.loginForm, "submit", handleWechatLogin);
  on(els.loginGuestBtn, "click", handleGuestLogin);

  // 实名认证
  on(els.topVerifyBtn, "click", () => { if (els.verifyError) els.verifyError.textContent = ""; els.verifyDialog?.showModal(); });
  on(els.mobileVerifyBtn, "click", () => { if (els.verifyError) els.verifyError.textContent = ""; els.verifyDialog?.showModal(); });
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
      // 切换视角时同步代保管点选择器可见性
      if (els.custodyPicker) {
        if (!isFound) {
          // 切到丢失视角：隐藏代保管点
          els.custodyPicker.hidden = true;
        } else {
          // 切到捡到视角：根据当前选中的 item_status 决定
          const checkedStatus = els.publishForm.querySelector('input[name="item_status"]:checked');
          els.custodyPicker.hidden = checkedStatus?.value !== "custody";
        }
      }
    });
  });
  els.publishForm?.querySelectorAll('input[name="item_status"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (els.custodyPicker) els.custodyPicker.hidden = radio.value !== "custody";
    });
  });

  // 通知
  on(els.markAllReadBtn, "click", handleMarkAllRead);
  on(els.refreshNotifyBtn, "click", async () => {
    await pollNotifications();
    renderNotifyList();
    showToast("消息已刷新", "success");
  });

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
    // token 无效（无 sub 字段）或已过期时，清除并重新登录
    // 避免无效 token 残留导致 currentUser 被设为空对象，按钮显示但请求 401
    if (!payload.sub || (payload.exp && Date.now() / 1000 > payload.exp)) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      autoLoginDemo();
      return;
    }
    // 页面刷新恢复登录时，JWT的exp是过期时间戳，不能作为经验值使用
    // 经验值应从用户对象获取，此处先设为0，后续可通过/api/auth?action=me获取完整信息
    currentUser = { ...payload, exp: 0 };
    // 切换/恢复用户后重置通知轮询起点，确保能拉取历史通知
    notifyLastPoll = new Date(0).toISOString();
    startNotifyPoll();
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
    // 自动登录后重置通知轮询起点，避免使用上一会话的时间戳
    notifyLastPoll = new Date(0).toISOString();
    startNotifyPoll();
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
  if (els.mobileVerifyBtn) els.mobileVerifyBtn.hidden = !(loggedIn && !currentUser.verified);
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
  const errorEl = els.verifyError;
  const submitBtn = els.verifyForm.querySelector('button[type="submit"]');

  // 清空之前的错误提示
  if (errorEl) errorEl.textContent = "";
  // loading 状态：按钮禁用 + 文字变化，让用户知道正在处理
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "认证中..."; }

  // 15 秒超时控制，避免网络卡顿时一直等待
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch("/api/auth?action=verify-identity", {
      method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) {
      // 在 dialog 内显示错误（toast 会被 dialog top layer 遮挡）
      const msg = payload.error || "认证失败";
      if (errorEl) errorEl.textContent = msg;
      showToast(msg, "error");
      return;
    }
    localStorage.setItem(AUTH_TOKEN_KEY, payload.token);
    const jwtPayload3 = decodeJwtPayload(payload.token);
    currentUser = { ...jwtPayload3, ...payload.user, exp: payload.user?.exp ?? 0 };
    addAccount(payload.token, payload.user);
    updateAuthUI();
    els.verifyDialog.close();
    // 清除记录缓存：认证前缓存的模糊记录需要失效，刷新后重新请求非模糊数据
    clearRecordsCache();
    showToast("实名认证成功！现在可以查看完整信息。", "success");
    setTimeout(() => window.location.reload(), 300);
  } catch (e) {
    const msg = e.name === "AbortError" ? "请求超时，请重试" : "网络错误";
    if (errorEl) errorEl.textContent = msg;
    showToast(msg, "error");
  } finally {
    clearTimeout(timeout);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "提交认证"; }
  }
}

// ============== AI 结构化输入 ==============
let aiExtractDebounce = null;
async function handleAiExtract() {
  const text = els.aiInput.value.trim();
  if (!text) { showToast("请先输入描述文字", "error"); return; }
  if (aiExtractDebounce) return;
  aiExtractDebounce = true;
  els.aiExtractBtn.disabled = true;
  els.aiExtractBtn.querySelector(".ai-extract-text").textContent = "正在结构化…";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);
  try {
    const response = await fetch("/api/structured-input", {
      method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ text }), signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.structured) {
      showToast(payload.error || "结构化失败，请手动填写", "error");
      return;
    }
    const structured = payload.structured;
    fillFormFields(structured);
    renderFieldConfidence(structured, payload);
    renderAiProcessingInfo(payload);
    const isAi = payload.source === "ai";
    const modelLabel = (payload.model || payload.ai_model) ? `，模型：${(payload.model || payload.ai_model).split("/").pop()}` : "";
    if (!isAi) {
      showToast("当前为离线规则降级；待确认与未识别字段必须人工补充", "warning");
    } else if (structured.requires_confirmation) {
      showToast(`模型已预填${modelLabel}，仍有字段需要人工确认`, "warning");
    } else {
      showToast(`模型已预填（整体置信度 ${Math.round((structured.confidence || 0) * 100)}%${modelLabel}）`, "success");
    }
  } catch (error) {
    showToast(error.name === "AbortError" ? "结构化请求超时，请手动填写" : "网络错误，请手动填写", "error");
  } finally {
    clearTimeout(timeout);
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
  if (titleInput) titleInput.value = s.title || "";
  const categorySelect = form.querySelector('select[name="category"]');
  if (categorySelect) categorySelect.value = [...categorySelect.options].some((option) => option.value === s.category) ? s.category : "";
  const colorSelect = form.querySelector('select[name="color"]');
  if (colorSelect) colorSelect.value = [...colorSelect.options].some((option) => option.value === s.color) ? s.color : "";

  const districtSelect = form.querySelector('select[name="district"]');
  const streetSelect = form.querySelector('select[name="street"]');
  const detailInput = form.querySelector('input[name="detail_location"]');
  if (districtSelect) {
    districtSelect.value = s.district || "";
    districtSelect.dispatchEvent(new Event("change"));
  }
  if (streetSelect && s.street) setTimeout(() => { setSelectValue(streetSelect, s.street); }, 50);
  if (detailInput) detailInput.value = s.detail_location || s.location || "";

  const timeInput = form.querySelector('input[name="time"]');
  if (timeInput) timeInput.value = s.time || "";
  const contactInput = form.querySelector('input[name="contact"]');
  if (contactInput) contactInput.value = s.contact || "";
  const descTextarea = form.querySelector('textarea[name="description"]');
  if (descTextarea) descTextarea.value = s.description || "";
  if (s.type === "found") els.itemStatusGroup.hidden = false;
  if (s.item_status) {
    const statusLabel = form.querySelector(`.status-option:has(input[name="item_status"][value="${s.item_status}"])`);
    if (statusLabel) statusLabel.click();
    els.custodyPicker.hidden = s.item_status !== "custody";
  }
  applyFieldStatusDecorations(s.field_status || {});
  if (els.aiFieldConfirmation) els.aiFieldConfirmation.hidden = false;
  if (els.confirmExtractedFields) els.confirmExtractedFields.checked = false;
}

function renderFieldConfidence(structured, payload) {
  if (!els.fieldConfidencePanel || !els.fieldConfidenceList) return;
  const labels = { type: "事件类型", item: "物品", title: "标题", category: "类别", color: "颜色", location: "地点", time: "时间", contact: "联系方式", features: "特征" };
  const statuses = structured.field_status || {};
  els.fieldConfidenceList.innerHTML = Object.entries(labels).map(([key, label]) => {
    const status = statuses[key] || "未识别";
    const className = status === "高置信" ? "high" : status === "待确认" ? "pending" : "missing";
    return `<div class="field-confidence-item"><span>${label}</span><span class="field-status ${className}">${status}</span></div>`;
  }).join("");
  const isAi = payload.source === "ai";
  els.extractionSourceBadge.textContent = isAi ? "真实模型返回" : "离线规则降级";
  const timeNote = structured.raw_time_expression
    ? `原始时间“${structured.raw_time_expression}”，时区 ${structured.time_zone || "Asia/Shanghai"}${structured.time_needs_confirmation ? "，需确认具体时刻" : ""}。`
    : "未识别可靠时间，请手动填写。";
  els.extractionSourceNotice.textContent = `${isAi ? "模型结果" : "规则结果"}仅用于预填。${timeNote}`;
  els.fieldConfidencePanel.hidden = false;
}

function renderAiProcessingInfo(payload) {
  if (!els.aiProcessingPanel || !els.aiProcessingGrid || !isAiEvidenceMode()) return;
  const reasonLabels = {
    missing_api_key: "未配置在线模型 Key",
    provider_timeout: "模型供应商响应超过预算",
    provider_rate_limited: "模型供应商限流",
    provider_5xx: "模型供应商服务异常",
    provider_network_error: "模型供应商网络异常",
    provider_payload_parse_error: "供应商响应格式异常",
    empty_model_content: "模型返回内容为空",
    parse_error: "模型 JSON 解析失败",
    total_budget_exhausted: "总时间预算耗尽",
    model_unavailable: "模型不可用",
  };
  const attempts = Array.isArray(payload.attempts) ? payload.attempts : [];
  const source = payload.source === "ai" ? "在线模型" : "启发式规则兜底";
  const fallbackReason = payload.fallback_reason ? (reasonLabels[payload.fallback_reason] || payload.fallback_reason) : "未发生降级";
  const attemptText = attempts.length
    ? attempts.map((attempt) => `${attempt.sequence}. ${String(attempt.model || "unknown").split("/").pop()} · ${attempt.outcome} · ${attempt.latency_ms}ms`).join("；")
    : "未调用在线模型";
  const items = [
    ["请求 ID", payload.request_id || "未返回"],
    ["本次来源", source],
    ["实际模型", payload.model || payload.ai_model || "无"],
    ["总耗时", Number.isFinite(payload.latency_ms) ? `${payload.latency_ms} ms` : "未记录"],
    ["是否降级", payload.source === "ai" && !payload.fallback_reason ? "否" : "是"],
    ["降级原因", fallbackReason],
    ["供应商状态", String(payload.provider_status ?? "未记录")],
    ["解析状态", payload.parse_status || "未记录"],
    ["调用尝试", attemptText],
  ];
  els.aiProcessingGrid.innerHTML = items.map(([label, value]) => (
    `<div class="ai-processing-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`
  )).join("");
  els.aiProcessingPanel.hidden = false;
  els.aiProcessingPanel.open = false;
}

function isAiEvidenceMode() {
  const params = new URLSearchParams(window.location.search);
  return ["1", "true"].includes(params.get("interview")) || ["1", "true"].includes(params.get("debug"));
}

function applyFieldStatusDecorations(statuses) {
  const selectors = {
    title: 'input[name="title"]', category: 'select[name="category"]', color: 'select[name="color"]',
    location: 'input[name="detail_location"]', time: 'input[name="time"]', contact: 'input[name="contact"]',
    features: 'textarea[name="description"]',
  };
  for (const [field, selector] of Object.entries(selectors)) {
    const element = els.publishForm.querySelector(selector);
    if (element) element.dataset.fieldStatus = statuses[field] || "未识别";
  }
}

function setSelectValue(select, value) {
  const opt = [...select.options].find((o) => o.value === value);
  if (opt) select.value = value;
}

// ============== 数据加载 ==============
// 记录列表缓存：30秒 TTL，避免频繁刷新重复请求后端
const RECORDS_CACHE_KEY = "shixun_ai_job_records_cache_v1";
const RECORDS_CACHE_TTL = 30000; // 30秒

function getRecordsCache() {
  try {
    const cached = localStorage.getItem(RECORDS_CACHE_KEY);
    if (!cached) return null;
    const payload = JSON.parse(cached);
    if (Date.now() - payload.timestamp > RECORDS_CACHE_TTL) return null;
    return { records: payload.records, source: payload.source || "cache" };
  } catch (e) { return null; }
}

function setRecordsCache(records, source) {
  try {
    localStorage.setItem(RECORDS_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), records, source }));
  } catch (e) { /* localStorage 满或不可用，静默 */ }
}

function clearRecordsCache() {
  try { localStorage.removeItem(RECORDS_CACHE_KEY); } catch (e) { /* 静默 */ }
}

function updateRuntimeStatus() {
  const el = document.getElementById("runtimeStatus");
  if (!el) return;
  el.textContent = runtimeDataSource === "demo_memory"
    ? "数据源：内存示例（Mock，可离线运行）"
    : runtimeDataSource === "supabase"
      ? "数据源：Supabase（真实持久化接口）"
      : "正在检测数据源…";
}

async function loadRecords() {
  recordsLoadState = { status: "loading", error: "" };
  renderItemList();
  try {
    const remoteRecords = await fetchPersistedRecords();
    recordsLoadState = { status: "loaded", error: "" };
    return remoteRecords;
  } catch (error) {
    console.error("loadRecords 失败:", error);
    recordsLoadState = { status: "error", error: error.message || "记录加载失败" };
    return [];
  }
}

async function hydrateRecord(record) {
  try {
    // 仅展示记录真实关联的图片；缺图时使用中性占位，不生成卡通示意图。
    const imageData = record.imageData || "";
    // 懒加载：已有 imageFeature 直接用，没有的设为 null，匹配时按需提取
    // 这样初始加载时不触发 Canvas 计算，大幅减少 hydrate 耗时
    const imageFeature = record.imageFeature || null;
    return { ...record, imageData, imageFeature, semantic: record.semantic || buildFallbackSemantic(record) };
  } catch (e) {
    console.error("hydrateRecord 失败:", record.id, e);
    return { ...record, imageData: record.imageData || "", imageFeature: null, semantic: record.semantic || buildFallbackSemantic(record) };
  }
}

// 按需提取图片特征（匹配时调用，避免初始加载时全量计算）
// 提取后缓存到记录对象上，避免同一记录重复计算
async function ensureImageFeature(record) {
  if (record.imageFeature) return record.imageFeature;
  if (!record.imageData) return null;
  const feature = await extractImageFeatures(record.imageData);
  record.imageFeature = feature;
  return feature;
}

async function fetchPersistedRecords() {
  const cached = getRecordsCache();
  if (cached) {
    runtimeDataSource = cached.source;
    updateRuntimeStatus();
    return cached.records;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch("/api/records", { headers: authHeaders(), signal: controller.signal });
    let payload = {};
    try { payload = await response.json(); } catch (error) { /* 由下面统一报错 */ }
    if (!response.ok) throw new Error(payload.error || `记录接口返回 ${response.status}`);
    runtimeDataSource = payload.source || "supabase";
    updateRuntimeStatus();
    const list = Array.isArray(payload.records) ? payload.records.filter(Boolean) : [];
    const hydrated = await Promise.all(list.map(hydrateRecord));
    setRecordsCache(hydrated, runtimeDataSource);
    return hydrated;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("记录加载超时，请检查本地服务或网络后重试");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadCustodyPoints() {
  try {
    const pointsResponse = await fetch("/api/custody?action=points", { headers: authHeaders() });
    if (pointsResponse.ok) {
      const pointsPayload = await pointsResponse.json();
      custodyPoints = pointsPayload.points || [];
    }

    const instResponse = await fetch("/api/custody?action=institutions", { headers: authHeaders() });
    if (instResponse.ok) {
      const instPayload = await instResponse.json();
      institutions = instPayload.institutions || [];
    }

    return custodyPoints;
  } catch (e) { return []; }
}

// ============== 渲染 ==============
function renderAll() {
  renderCategoryChips();
  renderItemList();
  renderQueryOptions();
  renderMatchView();
  renderStats();
  renderCustodyOptions();
  renderUserStatusBar();
  renderInspector();
}

// 根据当前类型筛选动态更新类别 chips
function renderCategoryChips() {
  const container = document.getElementById("filterChips");
  if (!container) return;

  // 基于当前类型筛选，统计各类别出现次数
  const typeFiltered = records.filter((r) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "institution") return r.item_status === "institution";
    return r.type === activeFilter;
  });

  const categoryCounts = {};
  typeFiltered.forEach((r) => {
    const cat = r.category;
    if (cat && cat !== "??" && cat.trim() !== "") {
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
  });

  // 按出现次数排序的类别列表
  const sortedCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);

  // 保留"全部"选项，后面跟实际存在的类别
  const allCategories = ["全部", ...sortedCategories];

  // 当前选中的类别
  const currentCategory = activeCategory;

  // 重新渲染 chips
  container.innerHTML = allCategories.map((cat) => {
    const filterVal = cat === "全部" ? "all" : cat;
    const isActive = currentCategory === filterVal ? "is-active" : "";
    return `<button class="filter-chip ${isActive}" data-filter="${escapeHtml(filterVal)}" type="button">${escapeHtml(cat)}</button>`;
  }).join("");

  // 重新绑定点击事件
  container.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const val = chip.dataset.filter;
      activeCategory = val;
      container.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      renderItemList();
    });
  });
}

function renderItemList() {
  if (!els.itemList) return;
  if (recordsLoadState.status === "loading") {
    els.itemList.innerHTML = `<div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><strong>正在加载记录…</strong><p>正在请求实际数据源，不使用静态数字替代。</p></div>`;
    return;
  }
  if (recordsLoadState.status === "error") {
    els.itemList.innerHTML = `<div class="error-state"><strong>记录加载失败</strong><p>${escapeHtml(recordsLoadState.error)}</p><button class="primary-action retry-button" id="retryRecordsBtn" type="button">重新加载</button></div>`;
    document.querySelector("#retryRecordsBtn")?.addEventListener("click", retryLoadRecords);
    updateHomeStatsFromList([]);
    return;
  }
  const query = normalizeText(els.searchInput.value);
  const category = activeCategory;
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
    : `<div class="empty-state"><strong>当前筛选没有结果</strong><p>数据已加载成功；请调整筛选条件或发布一条新记录。</p></div>`;
  bindCardActions();
  updateHomeStatsFromList(list);
  renderActiveFilters();
}

async function retryLoadRecords() {
  clearRecordsCache();
  records = await loadRecords();
  renderAll();
}

// 渲染当前激活的筛选标签

// 渲染当前激活的筛选标签
function renderActiveFilters() {
  const container = document.getElementById("activeFilters");
  if (!container) return;
  const tags = [];
  const district = els.filterDistrict?.value || "all";
  const street = els.filterStreet?.value || "all";

  // 类型筛选标签
  if (activeFilter !== "all") {
    const typeMap = { lost: "寻物", found: "招领", institution: "官方", hot: "高匹配" };
    tags.push({ type: "type", label: activeFilter, text: `类型：${typeMap[activeFilter] || activeFilter}` });
  }

  if (activeCategory !== "all") tags.push({ type: "category", label: activeCategory, text: `类别：${activeCategory}` });
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

  // 热门标签：从记录中提取高频类别（过滤掉无效类别如"??"）
  const categoryCounts = {};
  records.forEach(r => {
    const cat = r.category;
    if (cat && cat !== "??" && cat.trim() !== "") {
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
  });
  const topTags = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat]) => cat);

  if (topTags.length === 0) {
    tagsEl.innerHTML = `<p class="inspector-placeholder">暂无数据</p>`;
  } else {
    // 使用 data-* 属性 + 事件委托，避免内联 onclick 的 XSS 风险
    tagsEl.innerHTML = topTags.map(tag =>
      `<span class="inspector-tag" data-category="${escapeHtml(tag)}">${escapeHtml(tag)}</span>`
    ).join("");
    tagsEl.querySelectorAll(".inspector-tag").forEach(el => {
      el.addEventListener("click", () => setCategoryFilter(el.dataset.category));
    });
  }
}

// 从 Inspector 标签设置类别筛选
function setCategoryFilter(category) {
  activeCategory = category;
  // 同步 chip 状态（针对动态渲染的 filter-chips）
  const chipsContainer = document.getElementById("filterChips");
  if (chipsContainer) {
    // 如果目标类别不在当前 chips 中，先重置为全部
    const targetChip = chipsContainer.querySelector(`.filter-chip[data-filter="${CSS.escape(category)}"]`);
    if (!targetChip && category !== "all") {
      // 类别不在当前类型下，切换到全部类型以显示该类别
      activeFilter = "all";
      document.querySelectorAll(".filter-group [data-filter]").forEach((c) => c.classList.remove("is-active"));
      const allBtn = document.querySelector('.filter-group [data-filter="all"]');
      if (allBtn) allBtn.classList.add("is-active");
      renderCategoryChips();
    }
    // 重新查询并更新激活状态
    chipsContainer.querySelectorAll(".filter-chip").forEach(chip => {
      chip.classList.toggle("is-active", chip.dataset.filter === category);
    });
  }
  renderItemList();
}

// 清除单个筛选条件
function clearFilter(type) {
  if (type === "type") {
    activeFilter = "all";
    document.querySelectorAll(".filter-group [data-filter]").forEach((c) => c.classList.remove("is-active"));
    const allBtn = document.querySelector('.filter-group [data-filter="all"]');
    if (allBtn) allBtn.classList.add("is-active");
    // 重置类别筛选并重新渲染类别选项
    activeCategory = "all";
    renderCategoryChips();
  }
  if (type === "category") activeCategory = "all";
  if (type === "district" && els.filterDistrict) { els.filterDistrict.value = "all"; renderLocationStreets(); }
  if (type === "street" && els.filterStreet) els.filterStreet.value = "all";
  // 同步 chip 状态
  document.querySelectorAll("#filterChips .filter-chip").forEach(chip => {
    chip.classList.toggle("is-active", chip.dataset.filter === "all");
  });
  renderItemList();
}

function renderRecordImage(record, unavailableLabel = "暂无实物图片") {
  const src = String(record?.imageData || "").trim();
  const alt = escapeHtml(record?.title || "物品图片");
  if (!src) return `<span class="image-unavailable">${escapeHtml(unavailableLabel)}</span>`;
  return `<img src="${escapeHtml(src)}" alt="${alt}" onerror="this.hidden=true;this.nextElementSibling.hidden=false;" /><span class="image-unavailable" hidden>图片暂不可用</span>`;
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

  // 优先使用结构化地点展示
  const locationDisplay = record.district && record.street
    ? `${escapeHtml(record.district)} · ${escapeHtml(record.street)}`
    : escapeHtml(record.location);
  return `
    <article class="card${fuzzy ? " is-fuzzy" : ""}">
      <span class="thumb">
        ${renderRecordImage(record)}
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

async function renderMatchView() {
  if (!records.length) return;
  const nonce = ++matchRenderNonce;
  const queryId = els.queryRecord.value || records[0].id;
  const queryRecord = records.find((r) => r.id === queryId) || records[0];
  const comparableRecords = records.filter((record) => record.id !== queryRecord.id && record.type !== queryRecord.type);
  els.queryRecord.value = queryRecord.id;
  els.selectedRecord.innerHTML = renderMiniRecord(queryRecord);
  els.matchResults.innerHTML = `<div class="empty-state"><strong>正在准备视觉证据</strong><p>按需提取本地图像特征，失败时自动标记为缺失。</p></div>`;
  await Promise.all([queryRecord, ...comparableRecords].map((record) => ensureImageFeature(record).catch(() => null)));
  if (nonce !== matchRenderNonce) return;
  const matches = getMatchesFor(queryRecord).slice(0, 5);
  els.matchResults.innerHTML = matches.length
    ? matches.map((m) => renderMatchItem(m.record, m.result)).join("")
    : `<div class="empty-state"><strong>当前没有可匹配的信息</strong><p>发布一条信息，系统会为你寻找候选线索</p></div>`;
  els.matchResults.querySelectorAll("[data-detail-id]").forEach((btn) => {
    btn.addEventListener("click", () => openDetail(btn.dataset.detailId));
  });
  els.matchResults.querySelectorAll("[data-contact-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const record = records.find((r) => r.id === btn.dataset.contactId);
      if (record) showMatchContact(record);
    });
  });
  els.matchResults.querySelectorAll(".contact-disabled-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentUser?.verified) {
        showToast("招领信息需认领审核通过后解锁联系方式", "info");
      } else {
        showToast("请先完成模拟实名，再提交认领申请", "info");
        setTimeout(() => els.verifyDialog.showModal(), 500);
      }
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
    <span class="mini-record-media">${renderRecordImage(record)}</span>
    <div><strong>${escapeHtml(record.title)}</strong>
    <div class="meta-line">${record.type === "lost" ? "寻物" : "招领"} · ${escapeHtml(record.category)} · ${escapeHtml(record.color)}</div>
    <div class="meta-line">${escapeHtml(record.location)} · ${formatTime(record.time)}</div></div>
  </div>`;
}

function renderMatchItem(record, result) {
  const parts = result.breakdown;
  const score = Math.round(result.score);
  const scoreColor = score >= 80 ? "#34c759" : score >= 60 ? "#ff9500" : "#0071e3";
  const fuzzy = record.is_fuzzy;
  const dimensionRow = (key, label, color) => {
    const value = parts[key];
    const available = Number.isFinite(value);
    const width = available ? Math.round(value) : 0;
    return `<div class="match-dimension" style="--dim-width:${width}%;--dim-color:${color}"><span class="dim-label">${label}</span><div class="dim-bar"><div class="dim-fill"></div></div><span class="dim-val">${available ? `${width}%` : "缺失"}</span></div>`;
  };
  const contactAction = !fuzzy
    ? `<button class="ghost-button" data-contact-id="${record.id}" type="button">联系对方</button>`
    : currentUser?.verified
      ? `<button class="ghost-button contact-disabled-btn" type="button" aria-disabled="true">认领通过后解锁</button>`
      : `<button class="ghost-button contact-disabled-btn" type="button" aria-disabled="true">模拟实名后申请</button>`;
  return `<article class="match-item">
    <div class="match-item-media">
      ${renderRecordImage(record)}
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
        ${score >= 80 && result.coverage >= 65 ? '<span class="match-recommend">🔥 高排序候选</span>' : ""}
      </div>
      <h4>${escapeHtml(record.title)}</h4>
      <div class="evidence-coverage">证据覆盖：<strong>${Math.round(result.coverage)}%</strong> · ${result.missingDimensions.length ? `缺失 ${result.missingDimensions.map((key) => DIMENSION_LABELS[key]).join("、")}` : "字段完整"}</div>
      <div class="match-dimensions">
        ${dimensionRow("category", "类别", "#0071e3")}
        ${dimensionRow("color", "颜色", "#af52de")}
        ${dimensionRow("location", "地点", "#34c759")}
        ${dimensionRow("time", "时间", "#ff9500")}
        ${dimensionRow("text", "文本", "#ff3b30")}
        ${dimensionRow("image", "图像", "#5856d6")}
        ${dimensionRow("semantic", "语义", "#00a6a6")}
      </div>
      <ul class="reason-list">${result.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
      <div class="card-actions">
        <button class="ghost-button" data-detail-id="${record.id}" type="button">查看详情</button>
        ${contactAction}
      </div>
    </div>
  </article>`;
}

function renderStats() {
  if (!els.metricGrid) return;
  if (recordsLoadState.status !== "loaded") {
    const label = recordsLoadState.status === "error" ? "数据加载失败" : "数据加载中";
    els.metricGrid.innerHTML = `<div class="metric-card"><strong>${label}</strong><span>—</span></div>`;
    updateHomeStatsFromList([]);
    return;
  }
  const total = records.length;
  const today = records.filter((r) => isToday(r.time)).length;
  const strong = records.filter((r) => getBestMatch(r).score >= 80).length;
  const withSemantic = records.filter((r) => r.semantic).length;
  const metrics = [["记录总数（当前数据源）", total], ["今日记录", today], ["高排序候选", strong], ["含语义字段", withSemantic]];
  els.metricGrid.innerHTML = metrics.map(([label, value]) => `<div class="metric-card"><strong>${label}</strong><span>${value}</span></div>`).join("");
  updateHomeStats();
}

// 更新主界面成就统计面板

// 更新主界面成就统计面板（基于全部记录）
function updateHomeStats() {
  updateHomeStatsFromList(records);
}

// 基于指定记录列表更新统计面板
function updateHomeStatsFromList(list) {
  if (recordsLoadState.status !== "loaded") {
    ["statTotalRecovered", "statHelpedOthers", "statActiveItems", "statMyCredit"].forEach((id) => { const element = document.getElementById(id); if (element) element.textContent = "—"; });
    return;
  }
  // 已找回：状态为"已找回"或"已认领"的记录数
  const recovered = list.filter((r) => r.status === "已找回" || r.status === "已认领").length;
  // 帮他人找回：当前用户是招领发布者且已被认领的记录
  const currentId = currentUser?.sub;
  const helpedOthers = currentId
    ? list.filter((r) => r.type === "found" && r.owner_id === currentId && r.status === "已认领").length
    : 0;
  // 进行中：待找回 + 待认领
  const active = list.filter((r) => r.status === "待找回" || r.status === "待认领").length;
  // 信用分（不随筛选变化）
  const credit = currentUser ? (currentUser.credit_score ?? 0) : 0;

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
  if (startValue === targetValue) {
    el.textContent = String(targetValue);
    return;
  }

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
    if (els.filterStreetInput) {
      els.filterStreetInput.value = "";
      els.filterStreetInput.placeholder = "全部街道";
    }
    return;
  }
  const streets = STREET_DATA[district] || [];
  streetSelect.innerHTML = '<option value="all">全部街道</option>' +
    streets.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  streetSelect.disabled = false;
  if (els.filterStreetInput) {
    els.filterStreetInput.placeholder = "搜索或选择街道...";
  }
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
    ? currentUser?.verified
      ? `<div class="fuzzy-notice">🔒 招领信息需提交认领申请，并由发布者审核通过后解锁完整信息。</div>`
      : `<div class="fuzzy-notice">🔒 部分信息已模糊化处理，<button class="text-button verify-trigger" type="button">完成模拟实名</button>后可申请认领。</div>`
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

  // 认领区域：仅招领帖、非发布者、待认领状态显示
  let claimSection = "";
  if (!currentUser) {
    claimSection = `<div class="claim-section"><div class="claim-hint">登录后可申请认领或查看归还进度</div></div>`;
  } else if (!isOwn && record.type === "found" && record.status === "待认领" && !currentUser.verified) {
    claimSection = `<div class="claim-section"><div class="claim-hint">请先完成模拟实名，再提交认领申请</div><button class="primary-action verify-trigger" type="button">完成模拟实名</button></div>`;
  } else if (!isOwn && record.type === "found" && record.status === "待认领") {
    const hasQuestion = !!record.claim_question;
    const questionHtml = hasQuestion
      ? `<div class="claim-question">🔒 认领验证：${escapeHtml(record.claim_question)}</div>`
      : `<div class="claim-hint">请填写物品特征说明，便于发布者核实归属</div>`;
    const inputHtml = `<input class="claim-answer-input" id="claimAnswer" placeholder="${hasQuestion ? "请回答上述问题" : "请描述物品特征以证明归属"}" />`;
    claimSection = `<div class="claim-section">${questionHtml}${inputHtml}<button class="primary-action" id="claimBtn" type="button">申请认领</button></div>`;
  } else if (!isOwn && record.type === "found" && (record.status === "已认领" || record.status === "已找回")) {
    claimSection = `<div class="claim-section"><div class="claim-question">✅ 该物品已被认领</div></div>`;
  } else if (isOwn && record.type === "found" && record.status === "待认领") {
    // 发布者视角：提示等待他人申请认领
    claimSection = `<div class="claim-section"><div class="claim-hint">你是该招领帖发布者，等待失主申请认领后可在消息中心审核</div></div>`;
  }


  // 举报按钮
  const reportLink = !isOwn ? `<button class="report-link" id="reportBtn" type="button">举报该信息</button>` : "";

  // 找回确认按钮：招领帖发布者显示“确认已归还”，认领者显示“确认已收到”
  let recoverySection = "";
  if (record.status === "已认领" && currentUser) {
    if (record.type === "found" && isOwnRecord(record)) {
      recoverySection = `<button class="primary-action" id="markReturnedBtn" type="button">确认已归还</button>`;
    } else if (record.is_claimed_by_me) {
      recoverySection = `<button class="primary-action" id="confirmReceivedBtn" type="button">确认已收到</button>`;
    }
  } else if (record.status === "已找回") {
    recoverySection = `<div class="resolved-banner">✅ 找回已完成</div>`;
  }

  // 评价按钮（认领/找回完成后，发布者或认领者可见）
  let reviewSection = "";
  if (currentUser && (record.status === "已认领" || record.status === "已找回") && (isOwnRecord(record) || record.is_claimed_by_me)) {
    reviewSection = `<button class="ghost-button" id="reviewBtn" type="button">评价此次交易</button>`;
  }

  els.detailContent.innerHTML = `
    <div class="detail-content">
      <div class="detail-image-frame">${renderRecordImage(record)}</div>
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
        ${recoverySection}
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
      const hasQuestion = !!record.claim_question;
      if (hasQuestion && !answer) { showToast("请回答问题", "error"); return; }
      if (!hasQuestion && !answer) { showToast("请填写物品特征说明", "error"); return; }
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

  // 标记已归还
  const markReturnedBtn = els.detailContent.querySelector("#markReturnedBtn");
  if (markReturnedBtn) {
    markReturnedBtn.addEventListener("click", async () => {
      try {
        const resp = await fetch("/api/records?action=mark-returned", {
          method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ record_id: record.id }),
        });
        const data = await resp.json();
        if (data.ok) {
          showToast("已标记归还，等待失主确认", "success");
          els.detailDialog.close();
          clearRecordsCache();
          await loadRecords();
          renderAll();
        } else {
          showToast(data.error || "操作失败", "error");
        }
      } catch (e) { showToast("网络错误", "error"); }
    });
  }

  // 确认已收到
  const confirmReceivedBtn = els.detailContent.querySelector("#confirmReceivedBtn");
  if (confirmReceivedBtn) {
    confirmReceivedBtn.addEventListener("click", async () => {
      if (!confirm("确认已收到物品？确认后将完成找回流程并发放积分。")) return;
      try {
        const resp = await fetch("/api/records?action=confirm-received", {
          method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ record_id: record.id }),
        });
        const data = await resp.json();
        if (data.ok) {
          showToast("确认完成！积分已发放", "success");
          els.detailDialog.close();
          clearRecordsCache();
          await loadRecords();
          renderAll();
        } else {
          showToast(data.error || "操作失败", "error");
        }
      } catch (e) { showToast("网络错误", "error"); }
    });
  }
}

function showContactPrompt() {
  if (currentUser?.verified) {
    showToast("招领信息需认领审核通过后解锁联系方式", "info");
    return;
  }
  showToast("请先完成模拟实名，再提交认领申请", "info");
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
        <p><strong>联系电话：</strong><a href="tel:${escapeHtml(inst.contact)}">${escapeHtml(inst.contact)}</a></p>
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
    els.notifyList.innerHTML = `<div class="empty-state"><strong>暂无消息</strong><p>当有用户申请认领、审核结果或归还确认时，会出现在这里。</p></div>`;
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

// 轮询锁，防止 setInterval 导致的并发轮询竞态
let notifyPolling = false;
async function pollNotifications() {
  if (!currentUser) {
    updateNotifyBadge(0);
    return;
  }
  // 避免并发轮询：上一次还没完成就跳过本次
  if (notifyPolling) return;
  notifyPolling = true;
  try {
    const response = await fetch(`/api/notify?action=poll&since=${encodeURIComponent(notifyLastPoll)}`, { headers: authHeaders() });
    if (!response.ok) {
      // 失败时保留原有未读计数，不清零
      const existingUnread = notifications.filter((n) => !n.is_read).length;
      updateNotifyBadge(existingUnread);
      return;
    }
    const payload = await response.json();
    const newNotifs = payload.notifications || [];
    if (newNotifs.length) {
      const unread = newNotifs.filter((n) => !n.is_read);
      notifications = [...newNotifs, ...notifications].slice(0, 100);
      updateNotifyBadge(unread.length);
      if (unread.length) showToast(`${unread.length} 条新消息`, "info");
    } else {
      const existingUnread = notifications.filter((n) => !n.is_read).length;
      updateNotifyBadge(existingUnread);
    }
    // 仅在请求成功并解析完毕后才推进时间戳，失败时保持不变避免丢通知
    notifyLastPoll = newNotifs[0]?.created_at || new Date().toISOString();
  } catch (e) {
    console.error("[pollNotifications] 轮询失败:", e);
    // 失败时保留原有未读计数，不清零
    const existingUnread = notifications.filter((n) => !n.is_read).length;
    updateNotifyBadge(existingUnread);
  } finally {
    notifyPolling = false;
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
  if (els.aiFieldConfirmation && !els.aiFieldConfirmation.hidden && !els.confirmExtractedFields?.checked) {
    showToast("请先人工核对结构化字段并勾选确认", "warning");
    els.aiFieldConfirmation.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

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
    let imageData = uploadedImageData || "";
    
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
    
    const imageFeature = uploadedFeature || (imageData ? await extractImageFeatures(imageData) : null);
    const locationParts = [data.district, data.street, data.detail_location].filter(Boolean);
    const newRecord = {
      id: `record-${Date.now()}`, type: data.type, title: data.title.trim(),
      category: data.category, color: data.color,
      city: data.city || "北京市", district: data.district || "", street: data.street || "",
      detail_location: data.detail_location || "",
      location: locationParts.join(" ") || data.district || "",
      time: data.time, contact: data.contact.trim(), description: data.description.trim(),
      status: data.type === "lost" ? "待找回" : "待认领",
      item_status: data.item_status || "unknown",
      custody_point_id: data.custody_point_id || "",
      owner_id: currentUser?.sub || "",
      claim_question: data.claim_question?.trim() || "",
      imageData, imageFeature, semantic: uploadedSemantic || buildFallbackSemantic(data),
      visualSeed: null,
    };

    // 如果选择了代保管点，先寄存
    if (data.item_status === "custody" && data.custody_point_id) {
      const persisted = await persistRecord(newRecord);
      const saved = persisted || newRecord;
      records.unshift(saved);
      clearRecordsCache();
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
      clearRecordsCache();
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
            const levelMsg = `升级啦！Lv.${expData.newLevel} ${LEVEL_TITLES[expData.newLevel] || "拾遗新手"}`;
            showAchievementPopup("level_up", levelMsg);
            // 同时写入消息中心，方便用户回看
            try {
              await fetch("/api/notify?action=push", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                body: JSON.stringify({ type: "level_up", title: "升级啦", body: `恭喜${levelMsg}` }),
              });
            } catch (e) { /* 静默 */ }
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
        // 获取完整匹配对象（含 record 字段）用于通知
        const topMatch = getMatchesFor(newRecord)[0];
        if (topMatch && topMatch.record) {
          await fetch("/api/notify?action=push", {
            method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ user_id: currentUser.sub, type: "match_found", title: "发现高匹配线索", body: `您发布的"${newRecord.title}"与一条${topMatch.record.type === "lost" ? "寻物" : "招领"}记录匹配度达 ${Math.round(bestMatch.score)}%`, related_record_id: topMatch.record.id }),
          });
        }
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
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("[persistRecord] 保存失败:", response.status, err);
      return null;
    }
    const payload = await response.json();
    return payload.record ? hydrateRecord(payload.record) : null;
  } catch (e) {
    console.error("[persistRecord] 异常:", e);
    return null;
  }
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
      city: data.city || "北京市",
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
  // 重置认领问题输入框的显示状态（form.reset 不会触发 change 事件）
  if (els.claimQuestionGroup) els.claimQuestionGroup.hidden = true;
  els.aiInput.value = "";
  if (els.fieldConfidencePanel) els.fieldConfidencePanel.hidden = true;
  if (els.aiFieldConfirmation) els.aiFieldConfirmation.hidden = true;
  if (els.confirmExtractedFields) els.confirmExtractedFields.checked = false;
  els.publishForm.querySelectorAll("[data-field-status]").forEach((element) => delete element.dataset.fieldStatus);
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
    clearRecordsCache();
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

function escapeHtml(value) {
  const str = String(value ?? "");
  // 只转义 HTML 特殊字符，保留 Emoji 和其他 Unicode 字符
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
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

function calculateMatch(a, b, weights = WEIGHTS) {
  const available = {
    category: hasMeaningfulValue(a.category, ["其他", "未知"]) && hasMeaningfulValue(b.category, ["其他", "未知"]),
    color: hasMeaningfulValue(a.color, ["未知"]) && hasMeaningfulValue(b.color, ["未知"]),
    location: hasMeaningfulValue(a.location, ["未知地点"]) && hasMeaningfulValue(b.location, ["未知地点"]),
    time: hasValidTime(a.time) && hasValidTime(b.time),
    text: hasMeaningfulValue(`${a.title || ""} ${a.description || ""}`) && hasMeaningfulValue(`${b.title || ""} ${b.description || ""}`),
    image: Boolean(a.imageFeature && b.imageFeature),
    semantic: hasSemanticEvidence(a.semantic) && hasSemanticEvidence(b.semantic),
  };
  const raw = {
    category: available.category ? compareCategory(a.category, b.category) * 100 : null,
    color: available.color ? compareColorText(a.color, b.color) * 100 : null,
    location: available.location ? compareLocation(a.location, b.location) * 100 : null,
    time: available.time ? compareTime(a.time, b.time) * 100 : null,
    text: available.text ? compareTextSimilarity(`${a.title || ""} ${a.description || ""}`, `${b.title || ""} ${b.description || ""}`) * 100 : null,
    image: available.image ? compareImages(a.imageFeature, b.imageFeature) * 100 : null,
    semantic: available.semantic ? compareSemantics(a, b) * 100 : null,
  };
  const activeKeys = Object.keys(weights).filter((key) => available[key] && weights[key] > 0);
  const activeWeight = activeKeys.reduce((sum, key) => sum + weights[key], 0);
  const weightedScore = activeWeight
    ? activeKeys.reduce((sum, key) => sum + raw[key] * weights[key], 0) / activeWeight
    : 0;
  const coverage = clamp(activeWeight * 100, 0, 100);
  // 证据越少，排序分越保守，避免单一字段一致就出现虚高分。
  const confidenceFactor = 0.72 + (coverage / 100) * 0.28;
  const score = weightedScore * confidenceFactor;
  const missingDimensions = Object.keys(weights).filter((key) => weights[key] > 0 && !available[key]);
  const effectiveWeights = Object.fromEntries(Object.keys(weights).map((key) => [key, available[key] && activeWeight ? weights[key] / activeWeight : 0]));
  return {
    score: clamp(score, 0, 100),
    breakdown: raw,
    reasons: buildReasons(a, b, raw, missingDimensions, coverage),
    coverage,
    missingDimensions,
    effectiveWeights,
  };
}

function hasMeaningfulValue(value, blocked = []) {
  const normalized = String(value || "").trim();
  return Boolean(normalized && !blocked.includes(normalized));
}

function hasValidTime(value) {
  const time = new Date(value).getTime();
  return Boolean(value && Number.isFinite(time));
}

function hasSemanticEvidence(semantic) {
  if (!semantic || typeof semantic !== "object") return false;
  return Boolean(
    hasMeaningfulValue(semantic.object_name, ["未知物品"]) ||
    (Array.isArray(semantic.features) && semantic.features.length) ||
    (Array.isArray(semantic.visible_text) && semantic.visible_text.length)
  );
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
  const sA = a.semantic || buildFallbackSemantic(a);
  const sB = b.semantic || buildFallbackSemantic(b);
  const featuresA = Array.isArray(sA.features) ? sA.features : [];
  const featuresB = Array.isArray(sB.features) ? sB.features : [];
  const textA = Array.isArray(sA.visible_text) ? sA.visible_text : [];
  const textB = Array.isArray(sB.visible_text) ? sB.visible_text : [];
  const nameScore = compareTextSimilarity(sA.object_name || "", sB.object_name || "");
  const catScore = compareCategory(sA.category || "其他", sB.category || "其他");
  const colorScore = compareSemanticColors(sA.colors, sB.colors);
  const featScore = compareTextSimilarity(`${featuresA.join(" ")} ${textA.join(" ")}`, `${featuresB.join(" ")} ${textB.join(" ")}`);
  const brandScore = (sA.brand_guess && sB.brand_guess && sA.brand_guess !== "未知" && sB.brand_guess !== "未知")
    ? compareTextSimilarity(sA.brand_guess, sB.brand_guess)
    : 0.35;
  const conf = (Number(sA.confidence || 0.5) + Number(sB.confidence || 0.5)) / 2;
  return clamp((nameScore * 0.28 + catScore * 0.2 + colorScore * 0.16 + featScore * 0.26 + brandScore * 0.1) * (0.75 + conf * 0.25), 0, 1);
}

function compareSemanticColors(a, b) {
  const arrA = Array.isArray(a) ? a : []; const arrB = Array.isArray(b) ? b : [];
  if (!arrA.length || !arrB.length) return 0.35;
  return Math.max(...arrA.flatMap((cA) => arrB.map((cB) => compareColorText(cA, cB))));
}

function buildReasons(a, b, bd, missingDimensions = [], coverage = 100) {
  const positives = [];
  const caveats = [];
  if (Number.isFinite(bd.category) && bd.category >= 85) positives.push("物品类别一致，是强匹配因素");
  else if (Number.isFinite(bd.category) && bd.category >= 40) positives.push("物品类别存在关联");
  if (Number.isFinite(bd.location) && bd.location >= 80) positives.push("地点高度接近");
  else if (Number.isFinite(bd.location) && bd.location >= 55) positives.push("地点属于相邻区域");
  if (Number.isFinite(bd.time) && bd.time >= 80) positives.push("时间间隔较短");
  else if (Number.isFinite(bd.time) && bd.time >= 45) positives.push("时间间隔可接受");
  if (Number.isFinite(bd.image) && bd.image >= 75) positives.push("本地图像直方图与感知哈希相似");
  if (Number.isFinite(bd.semantic) && bd.semantic >= 78) {
    const sourceLabel = a.semantic?.source === "ai" && b.semantic?.source === "ai" ? "AI 图像语义" : "结构化语义标签";
    positives.push(`${sourceLabel}高度相似`);
  } else if (Number.isFinite(bd.semantic) && bd.semantic >= 55) {
    positives.push("结构化语义标签部分重合");
  }
  const tokensB = tokenize(`${b.title || ""} ${b.description || ""}`);
  const shared = [...tokenize(`${a.title || ""} ${a.description || ""}`)].filter((token) => tokensB.has(token));
  if (shared.length) positives.push(`描述关键词重合：${shared.slice(0, 4).join("、")}`);
  if (Number.isFinite(bd.color) && bd.color >= 85) positives.push(`颜色均接近${a.color}`);
  if (missingDimensions.length) caveats.push(`缺失${missingDimensions.map((key) => DIMENSION_LABELS[key]).join("、")}，对应权重已剔除`);
  if (coverage < 65) caveats.push("证据覆盖较低，建议补充图片、地点或时间后再人工核验");
  if (!positives.length) positives.push("仅有少量字段相似，仍需人工核验");
  return [...positives.slice(0, 3), ...caveats].slice(0, 5);
}

function buildFallbackSemantic(record) {
  return { object_name: record.title || "未知物品", category: record.category || "其他", colors: [record.color].filter(Boolean), brand_guess: "未知", visible_text: [], features: [...tokenize(`${record.title || ""} ${record.description || ""}`)].slice(0, 10), confidence: 0.45, source: "heuristic" };
}

async function analyzeImageSemantics(imageData) {
  try {
    const response = await fetch("/api/analyze-image", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ imageData }) });
    if (!response.ok) return null;
    const semantic = (await response.json()).semantic || null;
    return semantic ? { ...semantic, source: "ai" } : null;
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
      // 同时写入消息中心，方便用户回看
      try {
        await fetch("/api/notify?action=push", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ type: "badge_unlocked", title: "解锁新徽章", body: `恭喜获得：${data.badgeLabel}` }),
        });
      } catch (e) { /* 静默 */ }
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
    if (data.ok && data.delivered === false) {
      showToast(data.message || "离线单账号体验：仅演示提交动作，不会通知真实发布者", "info");
      els.detailDialog?.close();
    } else if (data.ok) {
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

// 可搜索下拉组件初始化
function initSearchSelect({ input, list, select, options, placeholder, onSelect }) {
  if (!input || !list || !select) return;

  function getOpts() {
    const raw = typeof options === "function" ? options() : options;
    return raw.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  }

  function renderDropdown(filter = "") {
    const opts = getOpts();
    const term = normalizeText(filter);
    const filtered = term
      ? opts.filter((o) => normalizeText(o.label).includes(term))
      : opts;
    if (!filtered.length) {
      list.innerHTML = `<li class="search-select-empty">无匹配结果</li>`;
    } else {
      list.innerHTML = filtered
        .map(
          (o) =>
            `<li class="search-select-option" data-value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</li>`
        )
        .join("");
    }
    list.hidden = false;
  }

  input.addEventListener("focus", () => renderDropdown(input.value));
  input.addEventListener("input", () => renderDropdown(input.value));

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const first = list.querySelector(".search-select-option");
      if (first) first.click();
    } else if (e.key === "Escape") {
      list.hidden = true;
    }
  });

  list.addEventListener("click", (e) => {
    const option = e.target.closest(".search-select-option");
    if (!option) return;
    const val = option.dataset.value;
    select.value = val;
    input.value = option.textContent;
    list.hidden = true;
    onSelect?.();
  });

  // 点击外部关闭
  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !list.contains(e.target)) {
      list.hidden = true;
    }
  });

  // 同步 select 变化到 input（如外部代码修改 select）
  select.addEventListener("change", () => {
    const opts = getOpts();
    const found = opts.find((o) => o.value === select.value);
    input.value = found ? found.label : select.value === "all" ? "" : select.value;
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
