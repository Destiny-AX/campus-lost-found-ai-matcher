"use strict";

const WEIGHTS = {
  category: 0.13,
  color: 0.08,
  location: 0.14,
  time: 0.11,
  text: 0.14,
  image: 0.2,
  semantic: 0.2,
};

const colorMap = {
  黑色: [26, 30, 38],
  白色: [238, 240, 235],
  蓝色: [54, 105, 201],
  红色: [214, 78, 68],
  黄色: [232, 175, 50],
  绿色: [30, 150, 100],
  银色: [176, 184, 190],
  透明: [202, 224, 229],
};

const categoryRelated = {
  证件: ["学习用品"],
  电子设备: ["学习用品"],
  生活用品: ["钥匙"],
  学习用品: ["证件", "电子设备"],
  钥匙: ["生活用品"],
  其他: [],
};

const locationGroups = {
  图书馆一楼: ["图书馆三楼", "教学楼A区"],
  图书馆三楼: ["图书馆一楼", "教学楼A区"],
  一食堂: ["二食堂", "宿舍区门口"],
  二食堂: ["一食堂", "宿舍区门口"],
  教学楼A区: ["教学楼B区", "图书馆一楼", "图书馆三楼"],
  教学楼B区: ["教学楼A区", "操场看台"],
  操场看台: ["教学楼B区", "宿舍区门口"],
  宿舍区门口: ["一食堂", "二食堂", "操场看台"],
};

const initialRecords = [
  {
    id: "lost-card-01",
    type: "lost",
    title: "蓝色校园卡套",
    category: "证件",
    color: "蓝色",
    location: "图书馆一楼",
    time: "2026-04-29T16:20",
    contact: "23 级设计一班 林同学",
    description: "蓝色透明卡套，里面有校园卡和门禁卡，卡套边缘有小星星贴纸。",
    status: "待找回",
    visualSeed: { background: "#d7edf8", primary: "#3769c9", secondary: "#ffffff", shape: "card" },
    semantic: {
      object_name: "蓝色校园卡套",
      category: "证件",
      colors: ["蓝色", "透明"],
      brand_guess: "未知",
      visible_text: ["校园卡"],
      features: ["透明卡套", "小星星贴纸", "校园卡", "门禁卡"],
      confidence: 0.92,
    },
  },
  {
    id: "found-card-01",
    type: "found",
    title: "蓝色学生卡",
    category: "证件",
    color: "蓝色",
    location: "图书馆大厅",
    time: "2026-04-29T16:45",
    contact: "图书馆服务台",
    description: "图书馆一楼入口捡到蓝色卡套，内有校园卡，卡套角落有贴纸。",
    status: "待认领",
    visualSeed: { background: "#d9effb", primary: "#2d65c6", secondary: "#f7fafc", shape: "card" },
    semantic: {
      object_name: "蓝色学生卡套",
      category: "证件",
      colors: ["蓝色", "白色"],
      brand_guess: "未知",
      visible_text: ["学生卡"],
      features: ["蓝色卡套", "角落贴纸", "校园卡"],
      confidence: 0.9,
    },
  },
  {
    id: "lost-earbud-01",
    type: "lost",
    title: "白色无线耳机盒",
    category: "电子设备",
    color: "白色",
    location: "一食堂",
    time: "2026-04-29T12:10",
    contact: "微信 student_chen",
    description: "白色无线耳机充电盒，外壳有细小划痕，可能落在一食堂靠窗座位。",
    status: "待找回",
    visualSeed: { background: "#f1f5f1", primary: "#f8f8f4", secondary: "#c5ccd2", shape: "earbud" },
    semantic: {
      object_name: "白色无线耳机盒",
      category: "电子设备",
      colors: ["白色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["充电盒", "圆角外壳", "细小划痕"],
      confidence: 0.88,
    },
  },
  {
    id: "found-earbud-01",
    type: "found",
    title: "白色耳机充电盒",
    category: "电子设备",
    color: "白色",
    location: "一食堂",
    time: "2026-04-29T12:35",
    contact: "一食堂值班窗口",
    description: "靠窗位置拾到白色耳机盒，表面有轻微划痕，没有耳机。",
    status: "待认领",
    visualSeed: { background: "#eef3f0", primary: "#ffffff", secondary: "#bfc8ce", shape: "earbud" },
    semantic: {
      object_name: "白色耳机充电盒",
      category: "电子设备",
      colors: ["白色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["耳机盒", "圆角", "轻微划痕"],
      confidence: 0.89,
    },
  },
  {
    id: "lost-umbrella-01",
    type: "lost",
    title: "黑色折叠伞",
    category: "生活用品",
    color: "黑色",
    location: "教学楼B区",
    time: "2026-04-28T18:05",
    contact: "电话 138****7120",
    description: "黑色折叠伞，伞柄有红色挂绳，可能遗忘在 B 区 204 教室。",
    status: "待找回",
    visualSeed: { background: "#e7e2dc", primary: "#20242c", secondary: "#dc6d57", shape: "umbrella" },
    semantic: {
      object_name: "黑色折叠伞",
      category: "生活用品",
      colors: ["黑色", "红色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["折叠伞", "红色挂绳", "黑色伞面"],
      confidence: 0.86,
    },
  },
  {
    id: "found-key-01",
    type: "found",
    title: "银色钥匙串",
    category: "钥匙",
    color: "银色",
    location: "宿舍区门口",
    time: "2026-04-29T21:00",
    contact: "宿管阿姨处",
    description: "宿舍区门口捡到三把银色钥匙，带一个绿色小挂件。",
    status: "待认领",
    visualSeed: { background: "#eff2ec", primary: "#b5bdc3", secondary: "#2f996f", shape: "key" },
    semantic: {
      object_name: "银色钥匙串",
      category: "钥匙",
      colors: ["银色", "绿色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["三把钥匙", "绿色挂件", "金属材质"],
      confidence: 0.9,
    },
  },
];

let records = [];
let activeFilter = "all";
let uploadedFeature = null;
let uploadedImageData = "";
let uploadedSemantic = null;

const els = {};
const OWN_RECORD_IDS_KEY = "campus-lost-found-own-record-ids";

document.addEventListener("DOMContentLoaded", async () => {
  cacheElements();
  bindEvents();
  records = await loadRecords();
  fillDefaultTime();
  renderAll();
});

function cacheElements() {
  els.itemList = document.querySelector("#itemList");
  els.searchInput = document.querySelector("#searchInput");
  els.categoryFilter = document.querySelector("#categoryFilter");
  els.queryRecord = document.querySelector("#queryRecord");
  els.selectedRecord = document.querySelector("#selectedRecord");
  els.matchResults = document.querySelector("#matchResults");
  els.publishForm = document.querySelector("#publishForm");
  els.submitButton = els.publishForm.querySelector(".submit-button");
  els.imageInput = document.querySelector("#imageInput");
  els.dropZone = document.querySelector("#dropZone");
  els.imagePreview = document.querySelector("#imagePreview");
  els.featurePreview = document.querySelector("#featurePreview");
  els.metricGrid = document.querySelector("#metricGrid");
  els.topAlerts = document.querySelector("#topAlerts");
  els.detailDialog = document.querySelector("#detailDialog");
  els.detailContent = document.querySelector("#detailContent");
  els.closeDialog = document.querySelector("#closeDialog");
}

function bindEvents() {
  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.viewTarget));
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((chip) => chip.classList.remove("is-active"));
      button.classList.add("is-active");
      renderItemList();
    });
  });

  els.searchInput.addEventListener("input", renderItemList);
  els.categoryFilter.addEventListener("change", renderItemList);
  els.queryRecord.addEventListener("change", renderMatchView);
  els.imageInput.addEventListener("change", handleImageUpload);
  bindDropUpload();
  els.publishForm.addEventListener("submit", handlePublish);
  els.closeDialog.addEventListener("click", () => els.detailDialog.close());
}

function bindDropUpload() {
  ["dragenter", "dragover"].forEach((eventName) => {
    els.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropZone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    els.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropZone.classList.remove("is-dragging");
    });
  });

  els.dropZone.addEventListener("drop", (event) => {
    const file = [...event.dataTransfer.files].find((item) => item.type.startsWith("image/"));
    if (!file) {
      renderUploadMessage("请拖入 JPG、PNG 或 WebP 图片。");
      return;
    }
    processUploadedImage(file);
  });
}

function switchView(view) {
  document.querySelectorAll(".view").forEach((section) => section.classList.remove("is-active"));
  document.querySelector(`#view-${view}`)?.classList.add("is-active");

  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.viewTarget === view);
  });

  if (view === "match") renderMatchView();
  if (view === "stats") renderStats();
}

async function loadRecords() {
  const seedRecords = await Promise.all(initialRecords.map(hydrateRecord));
  const remoteRecords = await fetchPersistedRecords();
  const remoteIds = new Set(remoteRecords.map((record) => record.id));
  return [...remoteRecords, ...seedRecords.filter((record) => !remoteIds.has(record.id))];
}

async function hydrateRecord(record) {
  const imageData = record.imageData || createSyntheticImage(record.visualSeed, record.title);
  const imageFeature = record.imageFeature || (await extractImageFeatures(imageData));
  return {
    ...record,
    imageData,
    imageFeature,
    semantic: record.semantic || buildFallbackSemantic(record),
  };
}

async function fetchPersistedRecords() {
  try {
    const response = await fetch("/api/records");
    if (!response.ok) return [];
    const payload = await response.json();
    const list = Array.isArray(payload.records) ? payload.records.filter(Boolean) : [];
    return Promise.all(list.map(hydrateRecord));
  } catch (error) {
    return [];
  }
}

function renderAll() {
  renderItemList();
  renderQueryOptions();
  renderMatchView();
  renderStats();
  renderTopAlerts();
}

function renderItemList() {
  const query = normalizeText(els.searchInput.value);
  const category = els.categoryFilter.value;
  let list = records.slice().sort((a, b) => new Date(b.time) - new Date(a.time));

  list = list.filter((record) => {
    const haystack = normalizeText(`${record.title}${record.category}${record.color}${record.location}${record.description}`);
    const matchesSearch = !query || haystack.includes(query);
    const matchesCategory = category === "all" || record.category === category;
    const matchesType =
      activeFilter === "all" ||
      record.type === activeFilter ||
      (activeFilter === "hot" && getBestMatch(record).score >= 75);
    return matchesSearch && matchesCategory && matchesType;
  });

  els.itemList.innerHTML = list.length
    ? list.map((record) => renderRecordCard(record)).join("")
    : `<div class="empty-state">没有找到符合条件的信息。</div>`;

  els.itemList.querySelectorAll("[data-detail-id]").forEach((button) => {
    button.addEventListener("click", () => openDetail(button.dataset.detailId));
  });

  els.itemList.querySelectorAll("[data-match-id]").forEach((button) => {
    button.addEventListener("click", () => {
      els.queryRecord.value = button.dataset.matchId;
      switchView("match");
    });
  });

  els.itemList.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", () => deleteRecord(button.dataset.deleteId));
  });
}

function renderRecordCard(record) {
  const best = getBestMatch(record);
  const ownActions = isOwnRecord(record)
    ? `<button class="danger-button" data-delete-id="${record.id}" type="button">删除</button>`
    : "";
  return `
    <article class="card">
      <span class="thumb">
        <img src="${record.imageData}" alt="${escapeHtml(record.title)}图片" />
        <span class="badge-row">
          <span class="status-badge ${record.type}">${record.type === "lost" ? "失物" : "招领"}</span>
          <span class="match-badge">最高匹配 ${Math.round(best.score)}%</span>
        </span>
      </span>
      <div class="card-body">
        <h4>${escapeHtml(record.title)}</h4>
        <div class="meta-line">
          <span class="meta-pill">${record.category}</span>
          <span class="meta-pill">${record.color}</span>
          <span class="meta-pill">${record.location}</span>
        </div>
        <p>${escapeHtml(record.description)}</p>
        <div class="meta-line">${formatTime(record.time)} · ${record.status}</div>
        <div class="card-actions">
          <button class="ghost-button" data-detail-id="${record.id}" type="button">详情</button>
          <button class="ghost-button" data-match-id="${record.id}" type="button">匹配</button>
          ${ownActions}
        </div>
      </div>
    </article>
  `;
}

function renderQueryOptions() {
  els.queryRecord.innerHTML = records
    .map((record) => `<option value="${record.id}">${record.type === "lost" ? "失物" : "招领"}｜${escapeHtml(record.title)}</option>`)
    .join("");
}

function renderMatchView() {
  if (!records.length) return;
  const queryId = els.queryRecord.value || records[0].id;
  const queryRecord = records.find((record) => record.id === queryId) || records[0];
  els.queryRecord.value = queryRecord.id;

  els.selectedRecord.innerHTML = renderMiniRecord(queryRecord);
  const matches = getMatchesFor(queryRecord).slice(0, 5);

  els.matchResults.innerHTML = matches.length
    ? matches.map((match) => renderMatchItem(match.record, match.result)).join("")
    : `<div class="empty-state">当前没有相反类型的信息可匹配。</div>`;

  els.matchResults.querySelectorAll("[data-detail-id]").forEach((button) => {
    button.addEventListener("click", () => openDetail(button.dataset.detailId));
  });
}

function renderMiniRecord(record) {
  return `
    <div class="mini-record">
      <img src="${record.imageData}" alt="${escapeHtml(record.title)}图片" />
      <div>
        <strong>${escapeHtml(record.title)}</strong>
        <div class="meta-line">${record.type === "lost" ? "失物" : "招领"} · ${record.category} · ${record.color}</div>
        <div class="meta-line">${record.location} · ${formatTime(record.time)}</div>
      </div>
    </div>
  `;
}

function renderMatchItem(record, result) {
  const parts = result.breakdown;
  return `
    <article class="match-item">
      <img src="${record.imageData}" alt="${escapeHtml(record.title)}图片" />
      <div>
        <div class="meta-line">
          <span class="status-badge ${record.type}">${record.type === "lost" ? "失物" : "招领"}</span>
          <span class="alert-score">${Math.round(result.score)}%</span>
        </div>
        <h4>${escapeHtml(record.title)}</h4>
        <div class="score-bar" aria-label="匹配度 ${Math.round(result.score)}%">
          <div class="score-fill" style="width: ${Math.round(result.score)}%"></div>
        </div>
        <div class="score-breakdown">
          <span>类别 ${Math.round(parts.category)}%</span>
          <span>颜色 ${Math.round(parts.color)}%</span>
          <span>地点 ${Math.round(parts.location)}%</span>
          <span>时间 ${Math.round(parts.time)}%</span>
          <span>文本 ${Math.round(parts.text)}%</span>
          <span>图像 ${Math.round(parts.image)}%</span>
          <span>语义 ${Math.round(parts.semantic)}%</span>
        </div>
        <ul class="reason-list">
          ${result.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}
        </ul>
        <div class="card-actions">
          <button class="ghost-button" data-detail-id="${record.id}" type="button">查看详情</button>
          <button class="danger-button" type="button">联系对方</button>
        </div>
      </div>
    </article>
  `;
}

function renderStats() {
  const total = records.length;
  const today = records.filter((record) => isToday(record.time)).length;
  const strongMatches = records.filter((record) => getBestMatch(record).score >= 80).length;
  const withSemantic = records.filter((record) => record.semantic).length;

  const metrics = [
    ["发布总数", total],
    ["今日新增", today],
    ["高匹配线索", strongMatches],
    ["语义识别记录", withSemantic],
  ];

  els.metricGrid.innerHTML = metrics
    .map(([label, value]) => `<div class="metric-card"><strong>${label}</strong><span>${value}</span></div>`)
    .join("");
}

function renderTopAlerts() {
  const alerts = records
    .flatMap((record) => getMatchesFor(record).slice(0, 1).map((match) => ({ source: record, ...match })))
    .sort((a, b) => b.result.score - a.result.score)
    .slice(0, 3);

  els.topAlerts.innerHTML = alerts
    .map(
      (alert) => `
        <div class="alert-item">
          <strong>${escapeHtml(alert.source.title)} ↔ ${escapeHtml(alert.record.title)}</strong>
          <span class="alert-score">${Math.round(alert.result.score)}%</span>
          <p>${escapeHtml(alert.result.reasons.slice(0, 2).join("，"))}</p>
        </div>
      `,
    )
    .join("");
}

function openDetail(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  const matches = getMatchesFor(record).slice(0, 3);
  const ownActions = isOwnRecord(record)
    ? `<button class="danger-button" data-delete-id="${record.id}" type="button">删除这条发布</button>`
    : "";

  els.detailContent.innerHTML = `
    <div class="detail-content">
      <img src="${record.imageData}" alt="${escapeHtml(record.title)}图片" />
      <div class="detail-body">
        <div>
          <span class="status-badge ${record.type}">${record.type === "lost" ? "失物" : "招领"}</span>
          <h3>${escapeHtml(record.title)}</h3>
        </div>
        <div class="meta-line">
          <span class="meta-pill">${record.category}</span>
          <span class="meta-pill">${record.color}</span>
          <span class="meta-pill">${record.location}</span>
          <span class="meta-pill">${formatTime(record.time)}</span>
        </div>
        <p>${escapeHtml(record.description)}</p>
        <p><strong>联系方式：</strong>${escapeHtml(record.contact)}</p>
        ${ownActions ? `<div class="card-actions">${ownActions}</div>` : ""}
        ${renderSemanticBlock(record.semantic)}
        <div>
          <strong>相似线索</strong>
          <ul class="reason-list">
            ${
              matches.length
                ? matches
                    .map((match) => `<li>${escapeHtml(match.record.title)}：${Math.round(match.result.score)}%，${escapeHtml(match.result.reasons[0] || "存在相似特征")}</li>`)
                    .join("")
                : "<li>暂无候选匹配项</li>"
            }
          </ul>
        </div>
      </div>
    </div>
  `;

  if (typeof els.detailDialog.showModal === "function") {
    els.detailDialog.showModal();
  }

  els.detailContent.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", () => deleteRecord(button.dataset.deleteId));
  });
}

function renderSemanticBlock(semantic) {
  if (!semantic) return "";
  return `
    <div>
      <strong>视觉语义标签</strong>
      <p>${escapeHtml(semantic.object_name)} · ${escapeHtml(semantic.category)} · 置信度 ${Math.round(semantic.confidence * 100)}%</p>
      <p>特征：${escapeHtml(semantic.features.join("、") || "暂无")}</p>
    </div>
  `;
}

async function handleImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  await processUploadedImage(file);
}

async function processUploadedImage(file) {
  if (!file.type.startsWith("image/")) {
    renderUploadMessage("请选择图片文件。");
    return;
  }
  const rawDataUrl = await readFileAsDataURL(file);
  const dataUrl = await resizeImageDataUrl(rawDataUrl, 980, 0.82);
  uploadedImageData = dataUrl;
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
  const colors = feature.palette
    .slice(0, 5)
    .map((rgb) => `<span class="swatch" style="background: rgb(${rgb.join(",")})"></span>`)
    .join("");
  const semanticHtml = semantic
    ? `<p>语义结果：${escapeHtml(semantic.object_name)} · ${escapeHtml(semantic.category)} · 置信度 ${Math.round(semantic.confidence * 100)}%<br />
      特征：${escapeHtml(semantic.features.slice(0, 4).join("、") || "暂无")}</p>`
    : `<p>${escapeHtml(statusText || "未获得语义识别结果，将使用本地图像特征匹配。")}</p>`;

  els.featurePreview.innerHTML = `
    <strong>图像特征已提取</strong>
    <p>主色 RGB：${feature.dominantColor.join(", ")}<br />
    感知哈希：${feature.hash.slice(0, 16)}...</p>
    <div class="swatch-row">${colors}</div>
    ${semanticHtml}
  `;
}

async function handlePublish(event) {
  event.preventDefault();
  if (els.publishForm.classList.contains("is-submitting")) return;
  setSubmitLoading(true);

  try {
    const form = new FormData(els.publishForm);
    const data = Object.fromEntries(form.entries());
    const fallbackImage = createSyntheticImage(
      {
        background: "#f3f6f4",
        primary: rgbToHex(colorMap[data.color] || [90, 110, 120]),
        secondary: "#ffffff",
        shape: data.category === "电子设备" ? "earbud" : data.category === "钥匙" ? "key" : data.category === "证件" ? "card" : "cup",
      },
      data.title,
    );
    const imageData = uploadedImageData || fallbackImage;
    const imageFeature = uploadedFeature || (await extractImageFeatures(imageData));

    const newRecord = {
      id: `record-${Date.now()}`,
      type: data.type,
      title: data.title.trim(),
      category: data.category,
      color: data.color,
      location: data.location,
      time: data.time,
      contact: data.contact.trim(),
      description: data.description.trim(),
      status: data.type === "lost" ? "待找回" : "待认领",
      imageData,
      imageFeature,
      semantic: uploadedSemantic || buildFallbackSemantic(data),
    };

    const persistedRecord = await persistRecord(newRecord);
    const savedRecord = persistedRecord || newRecord;
    records.unshift(savedRecord);
    markOwnRecord(savedRecord.id);
    els.publishForm.reset();
    fillDefaultTime();
    uploadedFeature = null;
    uploadedImageData = "";
    uploadedSemantic = null;
    els.imagePreview.innerHTML = "<span>暂无图片</span>";
    els.featurePreview.innerHTML = "<strong>图像特征与语义识别</strong><p>上传图片后显示提取结果。</p>";
    renderAll();
    els.queryRecord.value = savedRecord.id;
    switchView("match");
  } finally {
    setSubmitLoading(false);
  }
}

async function persistRecord(record) {
  try {
    const response = await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record }),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.record ? hydrateRecord(payload.record) : null;
  } catch (error) {
    return null;
  }
}

async function deleteRecord(id) {
  const record = records.find((item) => item.id === id);
  if (!record || !isOwnRecord(record)) return;
  if (!confirm("确定删除这条发布记录吗？删除后线上也会同步移除。")) return;

  try {
    setDeleteButtonsLoading(id, true);
    await deletePersistedRecord(id);
    records = records.filter((item) => item.id !== id);
    unmarkOwnRecord(id);
    if (els.detailDialog.open) els.detailDialog.close();
    renderAll();
  } catch (error) {
    alert("删除失败，请稍后重试。");
  } finally {
    setDeleteButtonsLoading(id, false);
  }
}

async function deletePersistedRecord(id) {
  const response = await fetch("/api/records", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) {
    throw new Error("Delete failed");
  }
}

function setSubmitLoading(isLoading) {
  els.publishForm.classList.toggle("is-submitting", isLoading);
  els.submitButton.disabled = isLoading;
  els.submitButton.classList.toggle("is-loading", isLoading);
  els.submitButton.innerHTML = isLoading
    ? `<span class="button-spinner" aria-hidden="true"></span><span>正在发布...</span>`
    : "发布并计算匹配";
}

function setDeleteButtonsLoading(id, isLoading) {
  document.querySelectorAll("[data-delete-id]").forEach((button) => {
    if (button.dataset.deleteId !== id) return;
    if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
    button.disabled = isLoading;
    button.textContent = isLoading ? "删除中..." : button.dataset.originalText || "删除";
  });
}

function getOwnRecordIds() {
  try {
    const value = JSON.parse(localStorage.getItem(OWN_RECORD_IDS_KEY) || "[]");
    return Array.isArray(value) ? value.map(String) : [];
  } catch (error) {
    return [];
  }
}

function saveOwnRecordIds(ids) {
  try {
    localStorage.setItem(OWN_RECORD_IDS_KEY, JSON.stringify([...new Set(ids.map(String))]));
  } catch (error) {
    // 本地存储不可用时，删除入口会在刷新后消失，不影响线上数据。
  }
}

function markOwnRecord(id) {
  saveOwnRecordIds([...getOwnRecordIds(), id]);
}

function unmarkOwnRecord(id) {
  saveOwnRecordIds(getOwnRecordIds().filter((item) => item !== String(id)));
}

function isOwnRecord(record) {
  return getOwnRecordIds().includes(String(record.id));
}

function getBestMatch(record) {
  return getMatchesFor(record)[0]?.result || { score: 0 };
}

function getMatchesFor(record) {
  return records
    .filter((candidate) => candidate.id !== record.id && candidate.type !== record.type)
    .map((candidate) => ({ record: candidate, result: calculateMatch(record, candidate) }))
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
  return {
    score: clamp(score, 0, 100),
    breakdown,
    reasons: buildReasons(a, b, breakdown),
  };
}

function compareCategory(a, b) {
  if (a === b) return 1;
  if (categoryRelated[a]?.includes(b) || categoryRelated[b]?.includes(a)) return 0.46;
  return 0.08;
}

function compareColorText(a, b) {
  if (a === b) return 1;
  const rgbA = colorMap[a] || [128, 128, 128];
  const rgbB = colorMap[b] || [128, 128, 128];
  return colorDistanceScore(rgbA, rgbB);
}

function compareLocation(a, b) {
  const normalizedA = normalizeLocation(a);
  const normalizedB = normalizeLocation(b);
  if (normalizedA === normalizedB) return 1;
  if (normalizedA.slice(0, 3) === normalizedB.slice(0, 3)) return 0.86;
  if (locationGroups[normalizedA]?.includes(normalizedB) || locationGroups[normalizedB]?.includes(normalizedA)) return 0.68;
  return 0.18;
}

function compareTime(a, b) {
  const deltaHours = Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 36e5;
  if (deltaHours <= 0.5) return 1;
  if (deltaHours <= 2) return 0.86;
  if (deltaHours <= 8) return 0.58;
  if (deltaHours <= 24) return 0.32;
  return 0.12;
}

function compareTextSimilarity(a, b) {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (!tokensA.size || !tokensB.size) return 0;
  const intersection = [...tokensA].filter((token) => tokensB.has(token)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  const jaccard = intersection / union;
  const charScore = diceCoefficient(normalizeText(a), normalizeText(b));
  return clamp(jaccard * 0.58 + charScore * 0.42, 0, 1);
}

function compareImages(a, b) {
  if (!a || !b) return 0.25;
  const hist = cosineSimilarity(a.histogram, b.histogram);
  const hash = 1 - hammingDistance(a.hash, b.hash) / a.hash.length;
  const dominant = colorDistanceScore(a.dominantColor, b.dominantColor);
  return clamp(hist * 0.58 + hash * 0.3 + dominant * 0.12, 0, 1);
}

function compareSemantics(a, b) {
  const semanticA = a.semantic || buildFallbackSemantic(a);
  const semanticB = b.semantic || buildFallbackSemantic(b);
  const nameScore = compareTextSimilarity(semanticA.object_name, semanticB.object_name);
  const categoryScore = compareCategory(semanticA.category, semanticB.category);
  const colorScore = compareSemanticColors(semanticA.colors, semanticB.colors);
  const featureScore = compareTextSimilarity(
    `${semanticA.features.join(" ")} ${semanticA.visible_text.join(" ")}`,
    `${semanticB.features.join(" ")} ${semanticB.visible_text.join(" ")}`,
  );
  const brandScore =
    semanticA.brand_guess &&
    semanticB.brand_guess &&
    semanticA.brand_guess !== "未知" &&
    semanticB.brand_guess !== "未知"
      ? compareTextSimilarity(semanticA.brand_guess, semanticB.brand_guess)
      : 0.35;
  const confidence = (Number(semanticA.confidence || 0.5) + Number(semanticB.confidence || 0.5)) / 2;
  return clamp((nameScore * 0.28 + categoryScore * 0.2 + colorScore * 0.16 + featureScore * 0.26 + brandScore * 0.1) * (0.75 + confidence * 0.25), 0, 1);
}

function compareSemanticColors(colorsA, colorsB) {
  const a = Array.isArray(colorsA) ? colorsA : [];
  const b = Array.isArray(colorsB) ? colorsB : [];
  if (!a.length || !b.length) return 0.35;
  return Math.max(...a.flatMap((colorA) => b.map((colorB) => compareColorText(colorA, colorB))));
}

function buildReasons(a, b, breakdown) {
  const reasons = [];
  if (breakdown.category >= 85) reasons.push("物品类别一致，是强匹配因素");
  else if (breakdown.category >= 40) reasons.push("物品类别存在关联，可作为候选线索");

  if (breakdown.location >= 80) reasons.push("地点高度接近，符合校园内拾取路径");
  else if (breakdown.location >= 55) reasons.push("地点属于相邻区域，有一定关联");

  if (breakdown.time >= 80) reasons.push("丢失与拾到时间间隔较短");
  else if (breakdown.time >= 45) reasons.push("时间间隔处在可接受范围内");

  if (breakdown.image >= 75) reasons.push("图片颜色分布和视觉结构相似");
  else if (breakdown.image >= 55) reasons.push("图片主色或整体色块有一定相似度");

  if (breakdown.semantic >= 78) reasons.push("视觉模型识别出的物品语义和外观特征高度相似");
  else if (breakdown.semantic >= 55) reasons.push("语义标签存在部分重合，可作为辅助线索");

  const shared = [...tokenize(`${a.title} ${a.description}`)].filter((token) => tokenize(`${b.title} ${b.description}`).has(token));
  if (shared.length) reasons.push(`描述关键词重合：${shared.slice(0, 4).join("、")}`);
  if (breakdown.color >= 85) reasons.push(`颜色均接近${a.color}`);
  if (!reasons.length) reasons.push("存在少量字段相似，但仍需人工核验");
  return reasons.slice(0, 5);
}

async function analyzeImageSemantics(imageData) {
  try {
    const response = await fetch("/api/analyze-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageData }),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.semantic || null;
  } catch (error) {
    return null;
  }
}

function buildFallbackSemantic(record) {
  return {
    object_name: record.title || "未知物品",
    category: record.category || "其他",
    colors: [record.color].filter(Boolean),
    brand_guess: "未知",
    visible_text: [],
    features: [...tokenize(`${record.title || ""} ${record.description || ""}`)].slice(0, 10),
    confidence: 0.45,
  };
}

async function extractImageFeatures(dataUrl) {
  const image = await loadImage(dataUrl);
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const histogram = new Array(64).fill(0);
  const colors = [];
  const gray = [];

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    if (alpha < 0.2) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const bin = (Math.floor(r / 64) << 4) + (Math.floor(g / 64) << 2) + Math.floor(b / 64);
    histogram[bin] += 1;
    colors.push([r, g, b]);
    gray.push(0.299 * r + 0.587 * g + 0.114 * b);
  }

  const total = histogram.reduce((sum, value) => sum + value, 0) || 1;
  const normalizedHistogram = histogram.map((value) => value / total);
  const dominantColor = getDominantColor(colors);
  const palette = getPalette(colors);
  const averageGray = gray.reduce((sum, value) => sum + value, 0) / (gray.length || 1);
  const hash = gray.map((value) => (value >= averageGray ? "1" : "0")).join("");

  return { histogram: normalizedHistogram, dominantColor, palette, hash };
}

function getDominantColor(colors) {
  if (!colors.length) return [128, 128, 128];
  const buckets = new Map();
  colors.forEach(([r, g, b]) => {
    const key = `${Math.round(r / 32) * 32},${Math.round(g / 32) * 32},${Math.round(b / 32) * 32}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });
  const [key] = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0];
  return key.split(",").map((value) => clamp(Number(value), 0, 255));
}

function getPalette(colors) {
  const buckets = new Map();
  colors.forEach(([r, g, b]) => {
    const key = `${Math.round(r / 48) * 48},${Math.round(g / 48) * 48},${Math.round(b / 48) * 48}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });
  return [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([key]) => key.split(",").map((value) => clamp(Number(value), 0, 255)));
}

function createSyntheticImage(seed, label) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = seed.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255,255,255,0.46)";
  ctx.fillRect(34, 34, 572, 412);
  ctx.fillStyle = seed.primary;
  ctx.strokeStyle = seed.secondary;
  ctx.lineWidth = 16;

  if (seed.shape === "card") drawCard(ctx, seed);
  if (seed.shape === "earbud") drawEarbud(ctx, seed);
  if (seed.shape === "umbrella") drawUmbrella(ctx, seed);
  if (seed.shape === "key") drawKey(ctx, seed);
  if (seed.shape === "cup") drawCup(ctx, seed);

  ctx.fillStyle = "rgba(24,32,43,0.72)";
  ctx.font = "bold 32px Microsoft YaHei, sans-serif";
  ctx.fillText(label.slice(0, 10), 54, 424);
  return canvas.toDataURL("image/png");
}

function drawCard(ctx, seed) {
  roundRect(ctx, 145, 130, 350, 220, 28);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = seed.secondary;
  roundRect(ctx, 190, 184, 160, 20, 10);
  ctx.fill();
  roundRect(ctx, 190, 232, 240, 18, 9);
  ctx.fill();
  ctx.fillStyle = "#e9a227";
  ctx.beginPath();
  ctx.arc(446, 168, 22, 0, Math.PI * 2);
  ctx.fill();
}

function drawEarbud(ctx, seed) {
  roundRect(ctx, 190, 185, 260, 150, 54);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = seed.secondary;
  ctx.beginPath();
  ctx.arc(260, 255, 24, 0, Math.PI * 2);
  ctx.arc(380, 255, 24, 0, Math.PI * 2);
  ctx.fill();
}

function drawUmbrella(ctx, seed) {
  ctx.beginPath();
  ctx.arc(320, 250, 150, Math.PI, 0);
  ctx.lineTo(170, 250);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = seed.secondary;
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(320, 250);
  ctx.lineTo(320, 345);
  ctx.quadraticCurveTo(320, 390, 370, 370);
  ctx.stroke();
}

function drawKey(ctx, seed) {
  ctx.beginPath();
  ctx.arc(230, 250, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = seed.background;
  ctx.beginPath();
  ctx.arc(230, 250, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = seed.primary;
  roundRect(ctx, 280, 232, 210, 36, 18);
  ctx.fill();
  ctx.fillRect(420, 268, 28, 52);
  ctx.fillRect(462, 268, 28, 36);
}

function drawCup(ctx, seed) {
  roundRect(ctx, 230, 120, 180, 245, 36);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = seed.secondary;
  ctx.beginPath();
  ctx.arc(416, 230, 52, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function resizeImageDataUrl(dataUrl, maxSide, quality) {
  const image = await loadImage(dataUrl);
  const largestSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
  if (!largestSide || largestSide <= maxSide && dataUrl.length < 900000) return dataUrl;

  const scale = Math.min(1, maxSide / largestSide);
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

function tokenize(text) {
  const normalized = normalizeText(text);
  const words = new Set();
  const keywords = [
    "校园卡",
    "学生卡",
    "门禁卡",
    "卡套",
    "耳机",
    "充电盒",
    "钥匙",
    "水杯",
    "雨伞",
    "图书馆",
    "食堂",
    "教学楼",
    "宿舍",
    "贴纸",
    "划痕",
    "挂件",
    "透明",
    "蓝色",
    "白色",
    "黑色",
    "银色",
    "绿色",
  ];

  keywords.forEach((keyword) => {
    if (normalized.includes(keyword)) words.add(keyword);
  });

  for (let i = 0; i < normalized.length - 1; i += 1) {
    words.add(normalized.slice(i, i + 2));
  }

  return words;
}

function diceCoefficient(a, b) {
  if (!a || !b) return 0;
  const gramsA = bigrams(a);
  const gramsB = bigrams(b);
  if (!gramsA.length || !gramsB.length) return a === b ? 1 : 0;
  const counts = new Map();
  gramsA.forEach((gram) => counts.set(gram, (counts.get(gram) || 0) + 1));
  let overlap = 0;
  gramsB.forEach((gram) => {
    const count = counts.get(gram) || 0;
    if (count > 0) {
      overlap += 1;
      counts.set(gram, count - 1);
    }
  });
  return (2 * overlap) / (gramsA.length + gramsB.length);
}

function bigrams(value) {
  const grams = [];
  for (let i = 0; i < value.length - 1; i += 1) grams.push(value.slice(i, i + 2));
  return grams;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。！？、,.!?;；:：()（）【】\[\]{}]/g, "");
}

function normalizeLocation(location) {
  if (location.includes("图书馆")) return location.includes("三") ? "图书馆三楼" : "图书馆一楼";
  if (location.includes("一食堂")) return "一食堂";
  if (location.includes("二食堂")) return "二食堂";
  if (location.includes("A")) return "教学楼A区";
  if (location.includes("B")) return "教学楼B区";
  return location;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function hammingDistance(a, b) {
  const length = Math.min(a.length, b.length);
  let distance = 0;
  for (let i = 0; i < length; i += 1) {
    if (a[i] !== b[i]) distance += 1;
  }
  return distance + Math.abs(a.length - b.length);
}

function colorDistanceScore(a, b) {
  const distance = Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
  return clamp(1 - distance / 441.67, 0, 1);
}

function formatTime(value) {
  const date = new Date(value);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function isToday(value) {
  const now = new Date();
  const date = new Date(value);
  return now.getFullYear() === date.getFullYear() && now.getMonth() === date.getMonth() && now.getDate() === date.getDate();
}

function fillDefaultTime() {
  const input = els.publishForm.querySelector('input[name="time"]');
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  input.value = now.toISOString().slice(0, 16);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}
