"use strict";

const crypto = require("crypto");

// AI 自然语言结构化提取 API
// POST /api/structured-input  { text: "..." }
// → 调用 SiliconFlow 文本模型，把自然语言提取为结构化字段

const {
  getSiliconFlowApiKey,
  readJsonBody,
  sendJson,
  safeErrorText,
  getCurrentUser,
} = require("./_shared");

// 文本模型：主模型 + 降级模型
// 主模型 DeepSeek-V4-Flash 输出稳定（content 字段直接含 JSON）；
// Qwen3-8B 作为降级（思考模式下 content 可能为空，需回退 reasoning_content）
const TEXT_MODEL = process.env.SILICON_FLOW_TEXT_MODEL || "deepseek-ai/DeepSeek-V4-Flash";
const FALLBACK_MODEL = process.env.SILICON_FLOW_FALLBACK_MODEL || "Qwen/Qwen3-8B";
const SILICON_FLOW_URL = process.env.SILICON_FLOW_BASE_URL || "https://api.siliconflow.cn/v1/chat/completions";
const MAX_TOKENS = 600;
const TOTAL_BUDGET_MS = clampInteger(process.env.SILICON_FLOW_TEXT_TOTAL_BUDGET_MS, 28000, 5000, 45000);
const PRIMARY_TIMEOUT_MS = clampInteger(process.env.SILICON_FLOW_TEXT_PRIMARY_TIMEOUT_MS, 18000, 3000, 30000);
const FALLBACK_TIMEOUT_MS = clampInteger(process.env.SILICON_FLOW_TEXT_FALLBACK_TIMEOUT_MS, 9000, 2000, 20000);

// 允许的类别枚举，AI 输出必须落在这些值上
const CATEGORIES = ["证件", "电子设备", "生活用品", "学习用品", "钥匙", "箱包", "贵重物品", "其他"];
const COLORS = ["黑色", "白色", "蓝色", "红色", "黄色", "绿色", "银色", "灰色", "粉色", "透明"];
const ITEM_STATUS = ["in_place", "custody", "picked", "institution", "unknown"];

// 区→街道映射（与前端保持一致，用于地点结构化提取）
// 统一为北京市 16 个区
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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  // 鉴权：必须登录才能调用 AI 提取，避免匿名滥用付费 API
  const current = getCurrentUser(req);
  if (!current) {
    sendJson(res, 401, { error: "请先登录" });
    return;
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    const apiKey = getSiliconFlowApiKey();
    const body = await readJsonBody(req);
    const text = String(body.text || "").trim();
    if (!text) {
      sendJson(res, 400, { error: "text 不能为空" });
      return;
    }

    // 没有 API Key 时走本地启发式 fallback，保证 demo 可用
    if (!apiKey) {
      sendJson(res, 200, buildFallbackResponse({
        requestId,
        startedAt,
        text,
        attempts: [],
        fallbackReason: "missing_api_key",
        providerStatus: "not_called",
        parseStatus: "not_attempted",
      }));
      return;
    }

    const prompt = buildPrompt(text);
    const result = await runModelCascade({ apiKey, prompt, originalText: text, requestId, startedAt });
    sendJson(res, 200, result);
  } catch (error) {
    // 顶层异常兜底，避免未处理异常导致进程崩溃
    sendJson(res, 500, { error: "结构化提取失败", detail: safeErrorText(error.message) });
  }
};

async function runModelCascade({
  apiKey,
  prompt,
  originalText,
  requestId = crypto.randomUUID(),
  startedAt = Date.now(),
  fetchImpl = fetch,
  totalBudgetMs = TOTAL_BUDGET_MS,
  primaryTimeoutMs = PRIMARY_TIMEOUT_MS,
  fallbackTimeoutMs = FALLBACK_TIMEOUT_MS,
  models = [TEXT_MODEL, FALLBACK_MODEL],
}) {
  const attempts = [];
  const uniqueModels = [...new Set(models.filter(Boolean))].slice(0, 2);
  let fallbackReason = "model_unavailable";
  let providerStatus = "not_called";
  let parseStatus = "not_attempted";

  for (let index = 0; index < uniqueModels.length; index += 1) {
    const elapsed = Date.now() - startedAt;
    const remaining = totalBudgetMs - elapsed;
    if (remaining < 500) {
      fallbackReason = "total_budget_exhausted";
      providerStatus = "budget_exhausted";
      break;
    }
    const configuredTimeout = index === 0 ? primaryTimeoutMs : fallbackTimeoutMs;
    const timeoutMs = Math.max(500, Math.min(configuredTimeout, remaining));
    const model = uniqueModels[index];
    const call = await callSiliconFlow(apiKey, model, prompt, { fetchImpl, timeoutMs });
    const attempt = {
      sequence: index + 1,
      model,
      latency_ms: call.latencyMs,
      outcome: call.ok ? "provider_success" : call.reason,
      provider_status: call.providerStatus,
      parse_status: "not_attempted",
    };
    attempts.push(attempt);
    providerStatus = call.providerStatus;

    if (call.ok) {
      try {
        const parsed = parsePossiblyFencedJson(call.content);
        validateModelPayload(parsed);
        const structured = normalizeStructured(parsed, originalText);
        attempt.outcome = "ai_success";
        attempt.parse_status = "success";
        parseStatus = "success";
        return {
          structured,
          request_id: requestId,
          source: "ai",
          model,
          ai_model: model,
          latency_ms: Date.now() - startedAt,
          attempts,
          fallback_reason: index > 0 ? fallbackReason : null,
          provider_status: providerStatus,
          parse_status: parseStatus,
        };
      } catch (error) {
        attempt.outcome = "parse_error";
        attempt.parse_status = "failed";
        parseStatus = "failed";
        fallbackReason = "parse_error";
        if (index === 0 && uniqueModels.length > 1) continue;
        break;
      }
    }

    fallbackReason = call.reason;
    parseStatus = "not_attempted";
    if (!call.retryable || index > 0) break;
  }

  return buildFallbackResponse({
    requestId,
    startedAt,
    text: originalText,
    attempts,
    fallbackReason,
    providerStatus,
    parseStatus,
  });
}

function buildFallbackResponse({ requestId, startedAt, text, attempts, fallbackReason, providerStatus, parseStatus }) {
  return {
    structured: heuristicExtract(text),
    request_id: requestId,
    source: "heuristic_fallback",
    model: null,
    ai_model: null,
    latency_ms: Date.now() - startedAt,
    attempts,
    fallback_reason: fallbackReason,
    provider_status: providerStatus,
    parse_status: parseStatus,
  };
}

// Calls SiliconFlow without returning provider payloads, secrets, or user text.
async function callSiliconFlow(apiKey, model, prompt, { fetchImpl = fetch, timeoutMs = 18000 } = {}) {
  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(SILICON_FLOW_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "你是失物招领信息结构化提取助手，必须严格输出 JSON。" },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: MAX_TOKENS,
        response_format: { type: "json_object" },
        ...(model.includes("Qwen3") ? { enable_thinking: false } : {}),
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const raw = await response.text();
    if (!response.ok) {
      const retryable = [408, 409, 425, 429].includes(response.status) || response.status >= 500;
      return {
        ok: false,
        content: "",
        reason: response.status === 429 ? "provider_rate_limited" : response.status >= 500 ? "provider_5xx" : `provider_http_${response.status}`,
        providerStatus: response.status,
        retryable,
        latencyMs: Date.now() - startedAt,
      };
    }
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (error) {
      return { ok: false, content: "", reason: "provider_payload_parse_error", providerStatus: response.status, retryable: true, latencyMs: Date.now() - startedAt };
    }
    const message = payload.choices?.[0]?.message || {};
    let content = message.content || "";
    if (!content && message.reasoning_content) {
      const jsonMatch = message.reasoning_content.match(/\{[\s\S]*\}/);
      if (jsonMatch) content = jsonMatch[0];
    }
    if (!content) {
      return { ok: false, content: "", reason: "empty_model_content", providerStatus: response.status, retryable: true, latencyMs: Date.now() - startedAt };
    }
    return { ok: true, content, reason: "", providerStatus: response.status, retryable: false, latencyMs: Date.now() - startedAt };
  } catch (error) {
    clearTimeout(timeout);
    const timedOut = error?.name === "AbortError";
    return {
      ok: false,
      content: "",
      reason: timedOut ? "provider_timeout" : "provider_network_error",
      providerStatus: timedOut ? "timeout" : "network_error",
      retryable: true,
      latencyMs: Date.now() - startedAt,
    };
  }
}

function validateModelPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("model payload must be an object");
  const hasCoreEvidence = [value.title, value.item_name, value.type, value.category, value.location]
    .some((item) => String(item || "").trim());
  if (!hasCoreEvidence) throw new Error("model payload has no core evidence");
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function buildPrompt(text) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const nowStr = now.toISOString().slice(0, 16);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  return [
    "从用户描述中提取失物招领信息，输出严格 JSON，不要输出其他内容。",
    "",
    "字段规则：",
    'title: 物品核心名称，≤15字。禁止包含颜色/数量/动作词。"黑色一加耳机"→"一加耳机"，"丢了身份证"→"身份证"',
    'type: "lost"(丢/遗失/掉了/不见了) 或 "found"(捡到/拾到/发现/看到)',
    "category: 从 [证件,电子设备,生活用品,学习用品,钥匙,箱包,贵重物品,其他] 中选1个。耳机→电子设备，校园卡套→证件",
    "color: 从 [黑色,白色,蓝色,红色,黄色,绿色,银色,灰色,粉色,透明] 中选1个，无则填空字符串",
    "location: 纯地点文本，去除动词前缀（在/丢在/捡到）",
    "district: 从北京16区中选 [东城区,西城区,朝阳区,丰台区,石景山区,海淀区,门头沟区,房山区,通州区,顺义区,昌平区,大兴区,怀柔区,平谷区,密云区,延庆区]，无法判断填空字符串",
    "street: 街道或地标名，如王府井、三里屯、中关村",
    "detail_location: 精确位置，如地铁站5号口、图书馆三楼",
    "time: ISO格式 YYYY-MM-DDTHH:mm",
    "contact: 联系方式（机构名+电话 或 手机号），去除动词前缀",
    'item_status: "in_place"(仍在原处) / "custody"(有人保管) / "institution"(已交机构) / "unknown"',
    "description: 通顺陈述句，整理口语化表达",
    "confidence: 0到1的数字",
    "",
    "时间换算参考：",
    `"昨天下午3点" → "${yesterdayStr}T15:00"`,
    `"今天上午" → "${todayStr}T08:00"`,
    `"刚刚" → "${nowStr}"`,
    "",
    "示例1：",
    `输入："昨天下午在王府井地铁站捡到一个黑色一加耳机，已交给服务台，电话010-65231234"`,
    '输出：{"type":"found","title":"一加耳机","category":"电子设备","color":"黑色","location":"王府井地铁站","district":"东城区","street":"王府井","detail_location":"地铁站",' + `"time":"${yesterdayStr}T15:00","contact":"王府井地铁站服务台 010-65231234","item_status":"institution","description":"在王府井地铁站捡到一加耳机，已交服务台","confidence":0.95}`,
    "",
    "示例2：",
    `输入："我的蓝色校园卡套丢了，里面有校园卡和门禁卡，可能在图书馆也可能是掉在路上了"`,
    '输出：{"type":"lost","title":"校园卡套","category":"证件","color":"蓝色","location":"图书馆",' + `"district":"","street":"","detail_location":"","time":"${todayStr}T12:00","contact":"","item_status":"unknown","description":"蓝色校园卡套丢失，内含校园卡和门禁卡","confidence":0.85}`,
    "",
    `当前时间: ${nowStr}`,
    "",
    "用户描述：",
    text,
  ].join("\n");
}

function normalizeStructured(value, originalText) {
  const data = value && typeof value === "object" ? value : {};
  const evidence = buildEvidence(originalText);
  const aiType = data.type === "found" ? "found" : data.type === "lost" ? "lost" : evidence.type.value;
  const aiTitle = sanitizeTitle(String(data.title || ""));
  const safeAiTitle = aiTitle && containsUsefulSourceToken(aiTitle, originalText) ? aiTitle : "";
  const title = evidence.item.title !== "待确认物品" ? evidence.item.title : (safeAiTitle || "待确认物品");
  const categoryCandidate = pickEnum(data.category, CATEGORIES, "其他");
  const category = evidence.item.category !== "其他" ? evidence.item.category : recategorizeByTitle(title, originalText, categoryCandidate);
  const sourceColor = COLORS.find((color) => originalText.includes(color)) || "";
  const aiLocation = String(data.location || "").trim();
  const location = evidence.location.value || (aiLocation && originalText.includes(aiLocation) ? aiLocation.slice(0, 60) : "");
  const district = evidence.location.district || pickEnum(data.district, Object.keys(STREET_DATA), "");
  const street = evidence.location.street || String(data.street || "").slice(0, 40);
  const detailLocation = evidence.location.detail_location || String(data.detail_location || "").slice(0, 60);
  const contactEvidence = extractReliableContact(originalText);
  const features = evidence.features.values.length
    ? evidence.features.values
    : (Array.isArray(data.features) ? data.features.filter((item) => originalText.includes(String(item))).slice(0, 5) : []);
  const fieldStatus = {
    ...evidence.field_status,
    type: evidence.type.status === "未识别" && (data.type === "lost" || data.type === "found") ? "待确认" : evidence.type.status,
    title: title === "待确认物品" ? "待确认" : (evidence.item.status === "高置信" ? "高置信" : "待确认"),
    category: category === "其他" ? "待确认" : (evidence.item.status === "高置信" ? "高置信" : "待确认"),
    location: location ? (evidence.location.status || "待确认") : "未识别",
    contact: contactEvidence.value ? "高置信" : "未识别",
    features: features.length ? "高置信" : "未识别",
  };
  return {
    type: aiType,
    item_name: evidence.item.name,
    title,
    category,
    color: sourceColor,
    location,
    district,
    street,
    detail_location: detailLocation,
    time: evidence.time.value,
    normalized_date: evidence.time.normalized_date,
    raw_time_expression: evidence.time.raw_expression,
    time_precision: evidence.time.precision,
    time_period: evidence.time.period,
    time_zone: evidence.time.time_zone,
    time_needs_confirmation: evidence.time.needs_confirmation,
    contact: contactEvidence.value,
    contact_type: contactEvidence.type,
    features,
    feature_text: features.join("；"),
    description: String(originalText || "").slice(0, 600),
    item_status: evidence.item_status,
    field_status: fieldStatus,
    requires_confirmation: Object.values(fieldStatus).some((status) => status !== "高置信"),
    confidence: clampNumber(Number(data.confidence), 0, 1, 0.7),
  };
}

function cleanTitle(title) {
  return sanitizeTitle(title);
}

function sanitizeTitle(title) {
  return String(title || "")
    .trim()
    .replace(/^(?:我(?:的)?|在|于|丢了|丢失了|遗失了|捡到|拾到|发现了?|一个|一张|一本|一串)\s*/g, "")
    .replace(/[，。,.！？!?；;：:].*$/, "")
    .trim()
    .slice(0, 40);
}

function containsUsefulSourceToken(title, source) {
  const tokens = String(title || "").match(/[A-Za-z0-9]+|[\u4e00-\u9fa5]{2,}/g) || [];
  return tokens.some((token) => String(source || "").toLowerCase().includes(token.toLowerCase()));
}

function pickEnum(value, allow, fallback) {
  const str = String(value || "").trim();
  if (allow.includes(str)) return str;
  // 部分匹配（例如 "电子产品" → "电子设备"）
  const found = allow.find((item) => str.includes(item) || item.includes(str));
  return found || fallback;
}

// 基于物品标题关键词的二次分类纠正
function recategorizeByTitle(title, originalText, currentCategory) {
  const combined = `${title} ${originalText}`.toLowerCase();
  // 高置信度关键词 → 强制分类
  const rules = [
    { keywords: ["校园卡套", "校园卡", "学生证", "身份证", "驾驶证", "护照", "门禁卡", "银行卡", "社保卡"], category: "证件" },
    { keywords: ["手机", "耳机", "耳塞", "airpods", "AirPods", "电脑", "笔记本", "平板", "ipad", "iPad", "充电器", "充电宝", "数据线", "u盘", "U盘", "蓝牙"], category: "电子设备" },
    { keywords: ["伞", "雨伞", "水杯", "保温杯", "口红", "化妆", "镜子", "梳子", "围巾", "帽子", "手套"], category: "生活用品" },
    { keywords: ["书", "课本", "教材", "笔", "本子", "文具", "笔记", "试卷", "计算器"], category: "学习用品" },
    { keywords: ["钥匙", "钥匙扣"], category: "钥匙" },
    { keywords: ["背包", "书包", "双肩包", "钱包", "手提包", "行李箱", "挎包", "单肩包", "公文包"], category: "箱包" },
    { keywords: ["手表", "项链", "戒指", "手镯", "耳环", "首饰", "金", "玉"], category: "贵重物品" },
  ];
  for (const { keywords, category } of rules) {
    if (keywords.some((kw) => combined.includes(kw))) return category;
  }
  return currentCategory;
}

function normalizeTime(value) {
  const str = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) return str.slice(0, 16);
  const parsed = Date.parse(str);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 16);
  // 兜底用当前时间
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function parsePossiblyFencedJson(value) {
  const text = String(value || "").trim();
  if (text.startsWith("{")) return JSON.parse(text);
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (match) return JSON.parse(match[1]);
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) return JSON.parse(objectMatch[0]);
  return {};
}

// 本地启发式提取（API Key 缺失或失败时使用）
// 时间解析：支持"昨天/今天/前天 + 上午/下午/晚上 + 具体时间"
const DEFAULT_TIME_ZONE = process.env.LOST_FOUND_TIME_ZONE || "Asia/Shanghai";
const FIELD_HIGH = "高置信";
const FIELD_PENDING = "待确认";
const FIELD_MISSING = "未识别";

function zonedDateParts(date = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function shiftDateParts(parts, offsetDays) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + offsetDays));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

function formatDateParts(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function parseChineseHour(token) {
  if (/^\d{1,2}$/.test(token)) return Number(token);
  const values = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10 };
  if (values[token]) return values[token];
  const match = String(token || "").match(/^十([一二])$|^([一二])十$/);
  if (match?.[1]) return 10 + values[match[1]];
  if (match?.[2]) return values[match[2]] * 10;
  return NaN;
}

function parseTimeEvidence(text, now = new Date()) {
  const source = String(text || "");
  const current = zonedDateParts(now);
  let dateParts = null;
  let hasExplicitDate = false;
  const ranges = [];
  const capture = (regex) => {
    const match = regex.exec(source);
    if (match) ranges.push({ start: match.index, end: match.index + match[0].length });
    return match;
  };

  const fullDate = capture(/(20\d{2})年(\d{1,2})月(\d{1,2})[日号]?/);
  const monthDay = fullDate ? null : capture(/(\d{1,2})月(\d{1,2})[日号]?/);
  const relative = capture(/今天|今日|昨天|昨日|昨晚|前天|前日/);
  // “上周五”等表达受执行日期影响较大：保留原文，但不擅自归一为某一天。
  const unsupportedRelative = relative ? null : capture(/(?:大概|大约|约)?上周[一二三四五六日天]/);
  if (fullDate) {
    dateParts = { year: Number(fullDate[1]), month: Number(fullDate[2]), day: Number(fullDate[3]) };
    hasExplicitDate = true;
  } else if (monthDay) {
    dateParts = { year: current.year, month: Number(monthDay[1]), day: Number(monthDay[2]) };
    const candidate = Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day);
    const today = Date.UTC(current.year, current.month - 1, current.day);
    if (candidate > today + 31 * 86400000) dateParts.year -= 1;
    hasExplicitDate = true;
  } else if (relative) {
    const offset = /昨天|昨日|昨晚/.test(relative[0]) ? -1 : /前天|前日/.test(relative[0]) ? -2 : 0;
    dateParts = shiftDateParts(current, offset);
    hasExplicitDate = true;
  }

  const periodMatch = capture(/凌晨|早上|早晨|清晨|上午|中午|下午|傍晚|晚上|夜间|夜里/);
  const period = /昨晚/.test(relative?.[0] || "") ? "晚上" : (periodMatch?.[0] || "");
  const clock = capture(/(?:^|[^\d一二三四五六七八九十])(\d{1,2}|[一二三四五六七八九十]{1,3})(?:点|时|:|：)(半|\d{1,2})?(?:\s*(左右|前后))?(?!\d)/);
  const approximateClock = Boolean(clock?.[3]);
  let hour = null;
  let minute = null;
  if (clock) {
    hour = parseChineseHour(clock[1]);
    minute = clock[2] === "半" ? 30 : clock[2] ? Number(clock[2]) : 0;
    if (/下午|傍晚|晚上|夜间|夜里/.test(period) && hour < 12) hour += 12;
    if (/中午/.test(period) && hour < 11) hour += 12;
    if (hour > 23 || minute > 59) { hour = null; minute = null; }
  }

  const rawExpression = ranges.length
    ? source.slice(Math.min(...ranges.map((range) => range.start)), Math.max(...ranges.map((range) => range.end))).trim()
    : "";
  const normalizedDate = dateParts ? formatDateParts(dateParts) : "";
  const inferredDate = !dateParts && hour !== null;
  if (inferredDate) dateParts = current;
  const value = hour !== null && dateParts && !approximateClock
    ? formatDateParts(dateParts) + "T" + String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0")
    : "";
  const precision = approximateClock
    ? "approximate"
    : hour !== null
      ? (inferredDate ? "exact_time_date_pending" : "exact")
      : normalizedDate
        ? (period ? "date_period" : "date")
        : period || unsupportedRelative
          ? "period"
          : "none";
  const status = hour !== null && hasExplicitDate && !approximateClock ? FIELD_HIGH : rawExpression ? FIELD_PENDING : FIELD_MISSING;
  return {
    value,
    normalized_date: normalizedDate,
    raw_expression: rawExpression,
    precision,
    period,
    time_zone: DEFAULT_TIME_ZONE,
    needs_confirmation: status !== FIELD_HIGH,
    status,
  };
}

function extractReliableContact(text) {
  const source = String(text || "");
  const email = source.match(/(?:邮箱|电子邮箱|email)?\s*[：:]?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  if (email) return { value: email[1], type: "email", status: FIELD_HIGH };
  const labeledPhone = source.match(/(?:手机号|手机|联系电话|电话)\s*[：:]\s*((?:1[3-9]\d{9})|(?:0\d{2,3}-?\d{7,8}))(?!\d)/);
  if (labeledPhone) return { value: labeledPhone[1], type: "phone", status: FIELD_HIGH };
  const standalonePhone = source.match(/(?<!\d)(1[3-9]\d{9})(?!\d)/);
  if (standalonePhone) return { value: standalonePhone[1], type: "phone", status: FIELD_HIGH };
  const wechat = source.match(/(?:微信号|微信|wx)\s*[：:]\s*([A-Za-z][A-Za-z0-9_-]{5,19}|[\u4e00-\u9fa5A-Za-z0-9_-]{2,20})/i);
  if (wechat) return { value: `微信：${wechat[1]}`, type: "wechat", status: FIELD_HIGH };
  // 无冒号仅接受严格 ASCII 微信号，并标为待确认；“微信聊天”等普通短语不会命中。
  const unlabeledWechat = source.match(/(?:^|[\s，,；;])(?:微信|wx)\s+([A-Za-z][A-Za-z0-9_-]{5,19})(?=$|[\s，。,.；;])/i);
  if (unlabeledWechat) return { value: "微信：" + unlabeledWechat[1], type: "wechat", status: FIELD_PENDING };
  const qq = source.match(/QQ\s*[：:]\s*([1-9]\d{4,11})/i);
  if (qq) return { value: `QQ：${qq[1]}`, type: "qq", status: FIELD_HIGH };
  return { value: "", type: "", status: FIELD_MISSING };
}

function extractLocationEvidence(text) {
  const source = String(text || "");
  const patterns = [
    { regex: /最后一次看到(?:是)?在\s*(.+?)(?=(?:丢了|丢失|遗失|掉了|不见了|捡到|拾到|发现)|[，。,.！？!?；;]|$)/, status: FIELD_PENDING },
    { regex: /地点(?:是|在|为)\s*(.+?)(?=[，。,.！？!?；;]|$)/, status: FIELD_HIGH },
    { regex: /可能(?:落|掉|遗失)?在\s*(.+?)(?=[，。,.！？!?；;]|$)/, status: FIELD_PENDING },
    { regex: /(?:在|于)\s*(.+?)(?=(?:丢了|丢失|遗失|掉了|不见了|落下(?:了)?|捡到|拾到|发现))/i, status: FIELD_HIGH },
    // 地点位于句首且没有“在”：只取动作前的短语，随后再剥离时间前缀。
    { regex: /^(?:我\s*)?(.+?)(?=(?:丢了|丢失|遗失|掉了|不见了|落下(?:了)?|捡到|拾到|发现))/, status: FIELD_HIGH },
    { regex: /(?:丢在|落在|忘在|遗失在|捡于|拾于)\s*(.+?)(?=[，。,.！？!?；;]|$)/, status: FIELD_HIGH },
  ];
  let value = "";
  let status = FIELD_MISSING;
  for (const pattern of patterns) {
    const match = source.match(pattern.regex);
    if (match) { value = match[1]; status = pattern.status; break; }
  }
  value = String(value || "")
    .replace(/^(?:(?:我\s*)?(?:大概|大约|约|可能)?\s*(?:(?:20\d{2}年)?\d{1,2}月\d{1,2}[日号]?|上周[一二三四五六日天]|今天|今日|昨日|昨天|昨晚|前天|前日)?\s*(?:凌晨|早上|早晨|清晨|上午|中午|下午|傍晚|晚上|夜间|夜里)?\s*(?:(?:\d{1,2}|[一二三四五六七八九十]{1,3})(?:点|时)(?:半|\d{1,2})?(?:左右|前后)?)?\s*(?:在|于)?\s*)/, "")
    .replace(/(?:把|将)\s*.*$/, "")
    .replace(/(?:丢了一个|丢了|捡到一个|捡到|拾到|遗失|落下).*$/, "")
    .replace(/(?:手机号|电话|微信号?|邮箱|QQ)\s*[：:].*$/i, "")
    .replace(/[，。,.！？!?；;：:]$/, "")
    .trim()
    .slice(0, 60);
  if (!value) status = FIELD_MISSING;
  if (/可能|或|附近|左右/.test(source) && value) status = FIELD_PENDING;
  let district = "";
  let street = "";
  const districtMatch = value.match(/(东城区|西城区|朝阳区|丰台区|石景山区|海淀区|门头沟区|房山区|通州区|顺义区|昌平区|大兴区|怀柔区|平谷区|密云区|延庆区)/);
  if (districtMatch) {
    district = districtMatch[1];
    street = (STREET_DATA[district] || []).find((candidate) => value.includes(candidate)) || "";
  } else {
    for (const [candidateDistrict, candidates] of Object.entries(STREET_DATA)) {
      const candidateStreet = candidates.find((candidate) => value.includes(candidate));
      if (candidateStreet) { district = candidateDistrict; street = candidateStreet; break; }
    }
  }
  return { value, status, district, street, detail_location: value };
}

const ITEM_RULES = [
  { regex: /AirPods\s*Pro/i, name: "AirPods Pro", category: "电子设备" },
  { regex: /AirPods|苹果耳机/i, name: "AirPods", category: "电子设备" },
  { regex: /(?:蓝牙|无线)?耳机(?:盒|充电盒)?/, name: "耳机", category: "电子设备" },
  { regex: /校园卡套/, name: "校园卡套", category: "证件" },
  { regex: /校园卡|学生卡|门禁卡/, name: "校园卡", category: "证件" },
  { regex: /身份证/, name: "身份证", category: "证件" },
  { regex: /学生证|驾驶证|护照|银行卡|社保卡/, name: "证件", category: "证件" },
  { regex: /(?:苹果|华为|小米|OPPO|VIVO|三星)?手机/i, name: "手机", category: "电子设备" },
  { regex: /(?:笔记本|MacBook|电脑)/i, name: "笔记本电脑", category: "电子设备" },
  { regex: /(?:iPad|平板电脑|平板)/i, name: "平板电脑", category: "电子设备" },
  { regex: /充电宝/i, name: "充电宝", category: "电子设备" },
  { regex: /充电器|数据线|U盘/i, name: "电子配件", category: "电子设备" },
  { regex: /钥匙(?:串|扣)?/, name: "钥匙", category: "钥匙" },
  { regex: /双肩包|背包|书包|钱包|手提包|行李箱|挎包/, name: "箱包", category: "箱包" },
  { regex: /雨伞|伞/, name: "雨伞", category: "生活用品" },
  { regex: /水杯|保温杯|杯子/, name: "水杯", category: "生活用品" },
  { regex: /口红|围巾|帽子|手套/, name: "生活用品", category: "生活用品" },
  { regex: /课本|教材|书|笔记本|文具|计算器/, name: "学习用品", category: "学习用品" },
  { regex: /手表|项链|戒指|手镯|耳环|首饰/, name: "贵重物品", category: "贵重物品" },
];

function extractItemEvidence(text) {
  const source = String(text || "");
  const rule = ITEM_RULES.find((item) => item.regex.test(source));
  const compactColorMap = { "黑": "黑色", "白": "白色", "蓝": "蓝色", "红": "红色", "黄": "黄色", "绿": "绿色", "银": "银色", "灰": "灰色", "粉": "粉色" };
  const compactColor = source.match(/([黑白蓝红黄绿银灰粉])(?=(?:雨?伞|杯子|水杯|保温杯|耳机|双肩包|背包|书包|充电宝|手机|钥匙))/);
  const color = COLORS.find((candidate) => source.includes(candidate)) || (compactColor ? compactColorMap[compactColor[1]] : "");
  if (!rule) return { name: "", title: "待确认物品", category: "其他", color, status: FIELD_MISSING };
  let name = rule.name;
  if (name === "耳机" && /索尼|Sony/i.test(source)) name = "索尼耳机";
  if (/AirPods\s*Pro/i.test(source) && /充电盒|耳机盒/.test(source)) name = "AirPods Pro 充电盒";
  else if (/AirPods/i.test(source) && /充电盒|耳机盒/.test(source)) name = "AirPods 充电盒";
  else if (name === "耳机" && /充电盒|耳机盒/.test(source)) name = "耳机充电盒";
  const title = [color, name].filter(Boolean).join(" ");
  return { name, title, category: rule.category, color, status: FIELD_HIGH };
}

function extractFeatures(text) {
  const clauses = String(text || "").split(/[，。,.；;！？!?]/).map((part) => part.trim()).filter(Boolean);
  const values = clauses.filter((clause) => /划痕|磨损|缺口|破损|贴纸|挂件|花纹|图案|字样|编号|里面有|内有|装有|外壳|保护壳|钥匙扣|表带/.test(clause)).slice(0, 5);
  return { values, status: values.length ? FIELD_HIGH : FIELD_MISSING };
}

function extractType(text) {
  const lost = /丢了|丢失|遗失|掉了|找不到|不见了|落下/.test(text);
  const found = /捡到|拾到|捡了|拾了|发现(?:了)?|看到一个/.test(text);
  if (lost && !found) return { value: "lost", status: FIELD_HIGH };
  if (found && !lost) return { value: "found", status: FIELD_HIGH };
  return { value: "lost", status: lost || found ? FIELD_PENDING : FIELD_MISSING };
}

function extractItemStatus(text) {
  if (/已交|交给|送到|交至|送至|交到/.test(text)) return "institution";
  if (/代为保管|拿着|带走|收着|保管/.test(text)) return "custody";
  if (/仍在原地|还在原地|还在那里|没动|放在原地/.test(text)) return "in_place";
  return "unknown";
}

function buildEvidence(text) {
  const type = extractType(text);
  const item = extractItemEvidence(text);
  const location = extractLocationEvidence(text);
  const time = parseTimeEvidence(text);
  const contact = extractReliableContact(text);
  const features = extractFeatures(text);
  const fieldStatus = {
    type: type.status,
    item: item.status,
    title: item.status === FIELD_HIGH ? FIELD_HIGH : FIELD_PENDING,
    category: item.category === "其他" ? FIELD_PENDING : FIELD_HIGH,
    color: item.color ? FIELD_HIGH : FIELD_MISSING,
    location: location.status,
    time: time.status,
    contact: contact.status,
    features: features.status,
  };
  return { type, item, location, time, contact, features, item_status: extractItemStatus(text), field_status: fieldStatus };
}

function heuristicExtract(text) {
  const source = String(text || "").trim();
  const evidence = buildEvidence(source);
  return {
    type: evidence.type.value,
    item_name: evidence.item.name,
    title: evidence.item.title,
    category: evidence.item.category,
    color: evidence.item.color,
    location: evidence.location.value,
    district: evidence.location.district,
    street: evidence.location.street,
    detail_location: evidence.location.detail_location,
    time: evidence.time.value,
    normalized_date: evidence.time.normalized_date,
    raw_time_expression: evidence.time.raw_expression,
    time_precision: evidence.time.precision,
    time_period: evidence.time.period,
    time_zone: evidence.time.time_zone,
    time_needs_confirmation: evidence.time.needs_confirmation,
    contact: evidence.contact.value,
    contact_type: evidence.contact.type,
    features: evidence.features.values,
    feature_text: evidence.features.values.join("；"),
    description: source.slice(0, 600),
    item_status: evidence.item_status,
    field_status: evidence.field_status,
    requires_confirmation: Object.values(evidence.field_status).some((status) => status !== FIELD_HIGH),
    confidence: evidence.item.status === FIELD_HIGH && evidence.location.status !== FIELD_MISSING ? 0.68 : 0.42,
  };
}

module.exports.heuristicExtract = heuristicExtract;
module.exports.parseTimeEvidence = parseTimeEvidence;
module.exports.extractReliableContact = extractReliableContact;
module.exports.extractLocationEvidence = extractLocationEvidence;
module.exports.runModelCascade = runModelCascade;
module.exports.callSiliconFlow = callSiliconFlow;
module.exports.validateModelPayload = validateModelPayload;
module.exports.buildPrompt = buildPrompt;
