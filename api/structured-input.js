"use strict";

// AI 自然语言结构化提取 API
// POST /api/structured-input  { text: "..." }
// → 调用 SiliconFlow 文本模型，把自然语言提取为结构化字段

const {
  getSiliconFlowApiKey,
  readJsonBody,
  sendJson,
  safeErrorText,
} = require("./_shared");

// 文本模型，与视觉模型分开（视觉模型也能跑文本但成本更高）
const TEXT_MODEL = process.env.SILICON_FLOW_TEXT_MODEL || "Qwen/Qwen3-8B";
const SILICON_FLOW_URL = process.env.SILICON_FLOW_BASE_URL || "https://api.siliconflow.cn/v1/chat/completions";

// 允许的类别枚举，AI 输出必须落在这些值上
const CATEGORIES = ["证件", "电子设备", "生活用品", "学习用品", "钥匙", "箱包", "贵重物品", "其他"];
const COLORS = ["黑色", "白色", "蓝色", "红色", "黄色", "绿色", "银色", "灰色", "粉色", "透明"];
const ITEM_STATUS = ["in_place", "custody", "picked", "institution", "unknown"];

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const apiKey = getSiliconFlowApiKey();
  const body = await readJsonBody(req);
  const text = String(body.text || "").trim();
  if (!text) {
    sendJson(res, 400, { error: "text 不能为空" });
    return;
  }

  // 没有 API Key 时走本地启发式 fallback，保证 demo 可用
  if (!apiKey) {
    sendJson(res, 200, { structured: heuristicExtract(text), source: "heuristic" });
    return;
  }

  const prompt = buildPrompt(text);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let response;
  try {
    response = await fetch(SILICON_FLOW_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [
          { role: "system", content: "你是失物招领信息结构化提取助手，必须严格输出 JSON。" },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    sendJson(res, 200, {
      structured: heuristicExtract(text),
      source: "heuristic_fallback",
      detail: safeErrorText(error.message),
    });
    return;
  }
  clearTimeout(timeout);

  const raw = await response.text();
  if (!response.ok) {
    sendJson(res, 200, {
      structured: heuristicExtract(text),
      source: "heuristic_fallback",
      detail: safeErrorText(raw),
    });
    return;
  }

  try {
    const payload = JSON.parse(raw);
    const content = payload.choices?.[0]?.message?.content || "{}";
    const structured = normalizeStructured(parsePossiblyFencedJson(content), text);
    sendJson(res, 200, { structured, source: "ai" });
  } catch (error) {
    sendJson(res, 200, {
      structured: heuristicExtract(text),
      source: "heuristic_fallback",
      detail: safeErrorText(error.message),
    });
  }
};

function buildPrompt(text) {
  return [
    "你是一位专业的失物招领信息提取助手。请从用户描述中精准提取关键信息，输出严格 JSON。",
    "",
    "## 提取规则（按优先级排序）",
    "",
    "### 1. title（最重要）",
    "- 只提取物品名称本身，绝对不要包含地点、时间、动作、状态等冗余信息",
    "- 去除所有修饰词：颜色、数量、大小、新旧等",
    '- 错误示例："黑色一加耳机" → 不要输出"黑色一加耳机"，正确输出："一加耳机"',
    '- 错误示例："在图书馆捡到一个蓝色校园卡套" → 不要输出整句话，正确输出："校园卡套"',
    '- 错误示例："丢了身份证" → 正确输出："身份证"',
    "- 控制在 15 字以内，优先使用常见物品名称",
    "",
    "### 2. type",
    '- "lost": 出现"丢""遗失""掉了""找不到""不见了"',
    '- "found": 出现"捡到""拾到""捡了""拾了""发现"',
    "",
    "### 3. category",
    `- 必须是以下之一：${CATEGORIES.join("、")}`,
    "",
    "### 4. color",
    `- 必须是以下之一：${COLORS.join("、")}`,
    "- 如果有多个颜色，只取物品主体颜色",
    "",
    "### 5. location",
    "- 精确提取地点，保留\"地铁站\"\"图书馆\"等关键地标",
    "- 去除动作词：\"在\"\"丢在\"\"捡到\"等",
    '- 错误示例："在传媒大学图书馆" → 正确："传媒大学图书馆"',
    "",
    "### 6. time",
    "- 解析相对时间并转换为 ISO 8601 格式（YYYY-MM-DDTHH:mm）",
    "- 昨天下午3点 = 昨天日期 15:00",
    "",
    "### 7. contact",
    "- 个人：提取手机号/微信号",
    `- 公共机构（派出所/地铁站/机场等）：填写"机构名称 + 电话"，如"南京东路派出所 021-63170110"`,
    "- 去除动词前缀：\"已联系\"\"交给\"\"送到\"等",
    '- 错误示例："已联系地铁站服务台" → 正确："地铁站服务台"',
    "",
    "### 8. description",
    "- 保留完整描述，去除口语化表达，整理为通顺陈述句",
    "",
    "### 9. item_status",
    `- ${ITEM_STATUS.join("/")} 之一`,
    "- \"已交\"\"交给\"\"送到\" → institution",
    "- \"代为保管\"\"拿着\" → custody",
    "- \"仍在原地\"\"还在\" → in_place",
    "",
    "## 输出示例",
    "",
    "输入：\"昨天下午在人民广场地铁站捡到一个黑色一加耳机，已交给服务台，电话 021-12345678\"",
    "输出：",
    '{"type":"found","title":"一加耳机","category":"电子设备","color":"黑色","location":"人民广场地铁站","time":"2026-06-03T15:00","contact":"人民广场地铁站服务台 021-12345678","description":"在人民广场地铁站捡到黑色一加耳机，已交给服务台","item_status":"institution","confidence":0.95}',
    "",
    "输入：\"我的蓝色校园卡套丢了，里面有校园卡和门禁卡，可能在图书馆\"",
    "输出：",
    '{"type":"lost","title":"校园卡套","category":"证件","color":"蓝色","location":"图书馆","time":"2026-06-04T10:00","contact":"","description":"蓝色校园卡套丢失，内有校园卡和门禁卡，最后出现在图书馆","item_status":"unknown","confidence":0.92}',
    "",
    `当前时间：${new Date().toISOString()}`,
    "",
    "## 用户描述",
    text,
  ].join("\n");
}

function normalizeStructured(value, originalText) {
  const data = value && typeof value === "object" ? value : {};
  const type = data.type === "found" ? "found" : "lost";

  // 公共机构名称列表，用于识别机构联系方式
  const institutionNames = [
    "派出所", "地铁站", "地铁", "机场", "失物招领中心",
    "服务中心", "物业", "值班室", "服务台", "游客中心",
    "图书馆", "学校", "大学", "公安局", "警务站",
  ];

  let contact = String(data.contact || "").slice(0, 120);
  // 如果 AI 返回的 contact 为空，但描述中包含公共机构关键词，尝试从描述中提取
  if (!contact && originalText) {
    const hasInstitution = institutionNames.some((name) => originalText.includes(name));
    if (hasInstitution) {
      // 尝试匹配 "机构名 + 电话/联系方式" 模式
      const contactMatch = originalText.match(/(.*?(?:派出所|地铁站|地铁|机场|服务中心|物业|值班室|服务台|游客中心|图书馆|公安局)[^，。,.！？!?；;：:\s]{0,20})[，。,.\s]*(?:电话|联系方式|联系|热线)?[：:]?\s*(\d{3,4}-?\d{6,8}|1\d{10})/);
      if (contactMatch) {
        contact = `${contactMatch[1].trim()} ${contactMatch[2].trim()}`;
      }
    }
  }

  // 二次清理 title：确保没有颜色词、动作词残留
  let title = cleanTitle(String(data.title || "").slice(0, 60));

  return {
    type,
    title,
    category: pickEnum(data.category, CATEGORIES, "其他"),
    color: pickEnum(data.color, COLORS, "黑色"),
    location: String(data.location || "未知地点").slice(0, 60),
    time: normalizeTime(data.time),
    contact,
    description: String(data.description || originalText).slice(0, 600),
    item_status: pickEnum(data.item_status, ITEM_STATUS, "unknown"),
    confidence: clampNumber(Number(data.confidence), 0, 1, 0.7),
  };
}

function cleanTitle(title) {
  if (!title) return "";
  // 去除颜色前缀（仅当颜色词后还有其他内容时）
  const colorPrefixes = ["黑色", "白色", "红色", "蓝色", "绿色", "黄色", "紫色", "橙色", "粉色", "灰色", "棕色", "银色", "金色", "彩色", "透明", "米色", "青色"];
  for (const cp of colorPrefixes) {
    if (title.startsWith(cp) && title.length > cp.length) {
      title = title.slice(cp.length);
      break;
    }
  }
  // 去除动作词前缀
  title = title.replace(/^(?:丢了|捡到|拾到|捡了|拾了|发现|看到一个|掉了|不见|找到|在|一个|個|了|和|的|是|有|个|一)\s*/, "");
  // 去除可能残留的"色"字
  title = title.replace(/^[色]\s*/, "");
  // 去除首尾空白和常见连接词
  return title.trim().replace(/^(?:的|是|有|个|一|了|和)\s*/, "").trim();
}

function pickEnum(value, allow, fallback) {
  const str = String(value || "").trim();
  if (allow.includes(str)) return str;
  // 部分匹配（例如 "电子产品" → "电子设备"）
  const found = allow.find((item) => str.includes(item) || item.includes(str));
  return found || fallback;
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
function heuristicExtract(text) {
  const lower = text;
  // 判断 lost/found：捡到/拾到 关键词出现则 found，否则 lost
  const type = /捡到|拾到|捡了|拾了|发现|看到一个/.test(lower) && !/丢|遗失|掉了|找不到|不见了/.test(lower)
    ? "found"
    : "lost";

  // 颜色匹配
  const color = COLORS.find((c) => lower.includes(c)) || "黑色";

  // 类别匹配（关键词字典）
  const categoryMap = {
    证件: ["身份证", "学生证", "校园卡", "驾驶证", "卡套", "证件"],
    电子设备: ["手机", "耳机", "笔记本", "电脑", "iPad", "ipad", "充电", "数据线", "蓝牙", "平板"],
    钥匙: ["钥匙"],
    箱包: ["背包", "双肩包", "手提包", "钱包", "书包", "行李", "挎包"],
    生活用品: ["伞", "水杯", "保温杯", "口红", "化妆", "镜子", "梳子"],
    学习用品: ["书", "课本", "笔", "本子", "文具", "教材", "资料"],
    贵重物品: ["手表", "项链", "戒指", "首饰", "手镯", "耳环"],
  };
  let category = "其他";
  for (const [key, keywords] of Object.entries(categoryMap)) {
    if (keywords.some((k) => lower.includes(k))) {
      category = key;
      break;
    }
  }

  // 地点：匹配"在 XX"、"丢在 XX"、"捡到 XX"模式，去除动作词前缀
  let location = "未知地点";
  const locPatterns = [
    /(?:在|丢在|落在|忘在|遗在|捡到|拾到|捡于|拾于|发现于|位于)\s*([^，。,.！？!?；;：:\s]{2,25}?)(?:[，。,.！？!?；;：:\s]|$)/,
    /([^，。,.！？!?；;：:\s]{2,25}?)(?:附近|旁边|门口|里面|外面|楼上|楼下)/,
  ];
  for (const pattern of locPatterns) {
    const match = lower.match(pattern);
    if (match) {
      location = match[1];
      break;
    }
  }
  // 过滤掉地点中可能包含的物品词
  const itemWords = ["手机", "耳机", "电脑", "笔记本", "iPad", "平板", "卡套", "钥匙", "背包", "钱包", "书包", "行李", "挎包", "水杯", "保温杯", "口红", "课本", "本子", "手表", "项链", "戒指", "首饰", "手镯", "耳环", "化妆", "镜子", "梳子", "证件", "书", "笔", "伞", "充电器", "数据线", "蓝牙耳机", "苹果手机", "一加耳机"];
  for (const word of itemWords) {
    if (location.includes(word)) {
      const idx = location.indexOf(word);
      if (idx === 0) {
        location = location.slice(word.length);
      } else if (idx + word.length === location.length) {
        location = location.slice(0, idx);
      }
    }
  }
  location = location.replace(/^(?:的|是|有|个|一|了|和|在|捡到|拾到|捡了|拾了|发现|看到一个|丢了|掉了|不见|找到)\s*/, "").trim();
  if (!location) location = "未知地点";

  // 时间：默认当前
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

  // 标题提取：精准提取物品名称
  let title = "";

  // 标题提取策略：
  // 使用 indexOf 精确查找关键词位置，避免正则贪婪匹配到地点中的字
  // 优先匹配更长的关键词，选择最靠后的匹配（通常在"一个/捡到/丢了"之后）

  // 标题提取策略：按关键词长度降序排列，确保优先匹配更长的复合词
  // 例如"校园卡套"优先于"校园卡"，"蓝牙耳机"优先于"耳机"
  const itemKeywords = [
    "校园卡套", "身份证", "学生证", "驾驶证", "双肩包", "手提包", "数据线", "充电器",
    "蓝牙耳机", "苹果手机", "一加耳机", "三星手机", "华为手机", "小米手机", "OPPO手机", "VIVO手机",
    "平板电脑", "笔记本电脑", "苹果电脑", "MAC电脑", "iPad", "平板", "卡套", "钥匙",
    "双肩包", "背包", "钱包", "书包", "行李箱", "挎包", "水杯", "保温杯", "口红",
    "课本", "本子", "手表", "项链", "戒指", "首饰", "手镯", "耳环", "化妆", "镜子", "梳子",
    "校园卡", "证件", "耳机", "手机", "电脑", "笔记本", "书", "笔", "伞",
  ];

  // 收集所有关键词匹配位置
  const matches = [];
  for (const keyword of itemKeywords) {
    const idx = lower.indexOf(keyword);
    if (idx !== -1) {
      // 提取关键词前面的修饰词（最多3个汉字）
      const before = text.slice(Math.max(0, idx - 3), idx);
      // 过滤掉地点词、动作词、量词、颜色词作为修饰词
      const cleanPrefix = before.replace(/^(?:在|到|了|和|的|是|有|个|一|了|黑色|白色|红色|蓝色|绿色|黄色|紫色|橙色|粉色|灰色|棕色|银色|金色|彩色|透明|米色|青色|深蓝|浅蓝|深灰|浅灰|玫红|藏青|香槟|咖啡|墨绿|天蓝|宝蓝)\s*/, "");
      matches.push({
        keyword,
        idx,
        prefix: cleanPrefix,
        full: cleanPrefix + keyword,
      });
    }
  }

  // 排序：优先选择更长的关键词，相同长度选更靠后的（更接近物品描述部分）
  matches.sort((a, b) => {
    if (b.keyword.length !== a.keyword.length) return b.keyword.length - a.keyword.length;
    return b.idx - a.idx;
  });

  if (matches.length > 0) {
    const best = matches[0];
    title = best.full;
  }

  // 清理标题：去除常见前缀（动作词、量词）
  title = title.replace(/^(?:丢了|捡到|拾到|捡了|拾了|发现|看到一个|掉了|不见|找到|在|一个|個|了|和|的)\s*/, "");

  // 去除颜色词前缀（仅当颜色词后还有其他内容时）
  const colorPrefixes = ["黑色", "白色", "红色", "蓝色", "绿色", "黄色", "紫色", "橙色", "粉色", "灰色", "棕色", "银色", "金色", "彩色", "透明", "米色", "青色", "深蓝色", "浅蓝色", "深灰色", "浅灰色", "玫红色", "藏青色", "香槟色", "咖啡色", "墨绿色", "天蓝色", "宝蓝色"];
  for (const cp of colorPrefixes) {
    if (title.startsWith(cp) && title.length > cp.length) {
      title = title.slice(cp.length);
      break;
    }
  }

  // 去除可能残留的"色"字
  title = title.replace(/^[色]\s*/, "");

  // 去除首尾空白和常见连接词（注意：不要去掉合法的一/二/三数字前缀）
  title = title.trim().replace(/^(?:的|是|有|个|了|和)\s*/, "").trim();

  // 兜底：如果 title 为空或仍包含整句话，取 text 前 15 字
  if (!title || title.length > 20) {
    title = text.replace(/^(?:在|丢在|落在|忘在|遗在|捡到|拾到|捡于|拾于|发现于|位于|我的|昨天|今天|上周|上周|最近|刚才)\s*/, "").slice(0, 15);
  }

  // 公共机构联系方式提取
  const institutionNames = ["派出所", "地铁站", "地铁", "机场", "失物招领中心", "服务中心", "物业", "值班室", "服务台", "游客中心", "图书馆", "学校", "大学", "公安局", "警务站"];
  let contact = "";
  const hasInstitution = institutionNames.some((name) => lower.includes(name));
  if (hasInstitution) {
    // 策略1：匹配 "XX机构 + 电话 + 号码"
    const contactMatch = text.match(/(?:在|给|交给|送到|送至|交至|交到|已送至|已交至|已送到|已交给)?[^\u4e00-\u9fa5]?([\u4e00-\u9fa5]{1,10}(?:派出所|地铁站|机场|服务中心|物业|值班室|服务台|游客中心|图书馆|公安局))[^\u4e00-\u9fa5]{0,5}[，。,.\s]*(?:电话|联系方式|联系|热线)?[：:]?\s*(\d{3,4}-?\d{6,8}|1\d{10})?/);
    if (contactMatch) {
      contact = contactMatch[1].trim();
      if (contactMatch[2]) contact += " " + contactMatch[2].trim();
    } else {
      // 策略2：直接匹配机构名（前面允许有动作词分隔）
      const instMatch = text.match(/(?:在|给|交给|送到|送至|交至|交到|已送至|已交至|已送到|已交给)?[^\u4e00-\u9fa5]?([\u4e00-\u9fa5]{1,10}(?:派出所|地铁站|机场|服务中心|物业|值班室|服务台|游客中心|图书馆|公安局))/);
      if (instMatch) contact = instMatch[1].trim();
    }
  }

  // 严格清理联系方式中的动词前缀（按长度降序，优先匹配更长的前缀）
  const verbPrefixes = ["已联系", "已交给", "已通知", "已告知", "已转交", "已送至", "已交至", "已送到", "已交给", "联系", "交给", "通知", "告知", "转交", "送到", "送至", "交至", "交到", "给"];
  for (const prefix of verbPrefixes) {
    if (contact.startsWith(prefix)) {
      contact = contact.slice(prefix.length).trim();
      break;
    }
  }

  // 如果没有机构，尝试提取手机号
  if (!contact) {
    const phoneMatch = text.match(/1\d{10}/);
    if (phoneMatch) contact = phoneMatch[0];
  }

  // 物品状态判断
  let item_status = "unknown";
  if (/已交|交给|送到|交至|送至|交到/.test(lower)) item_status = "institution";
  else if (/代为保管|拿着|带走|收着|保管/.test(lower)) item_status = "custody";
  else if (/仍在原地|还在原地|还在那里|没动|放在原地/.test(lower)) item_status = "in_place";

  return {
    type,
    title,
    category,
    color,
    location,
    time: now.toISOString().slice(0, 16),
    contact,
    description: text.slice(0, 600),
    item_status,
    confidence: 0.4,
  };
}
