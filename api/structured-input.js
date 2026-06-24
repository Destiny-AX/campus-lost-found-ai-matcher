"use strict";

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
// 主模型 Qwen3-8B 较轻量；若主模型不可用则降级到 DeepSeek-V4-Flash
const TEXT_MODEL = process.env.SILICON_FLOW_TEXT_MODEL || "Qwen/Qwen3-8B";
const FALLBACK_MODEL = process.env.SILICON_FLOW_FALLBACK_MODEL || "deepseek-ai/DeepSeek-V4-Flash";
const SILICON_FLOW_URL = process.env.SILICON_FLOW_BASE_URL || "https://api.siliconflow.cn/v1/chat/completions";
const MAX_TOKENS = 800;

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
      sendJson(res, 200, { structured: heuristicExtract(text), source: "heuristic", ai_error: "API Key 未配置" });
      return;
    }

    const prompt = buildPrompt(text);

    // 依次尝试主模型和降级模型，任一成功即返回
    const models = [TEXT_MODEL, FALLBACK_MODEL];
    let lastError = "";
    for (const model of models) {
      const result = await callSiliconFlow(apiKey, model, prompt);
      if (result.ok) {
        try {
          const structured = normalizeStructured(parsePossiblyFencedJson(result.content), text);
          sendJson(res, 200, { structured, source: "ai", ai_model: model });
          return;
        } catch (parseErr) {
          // 解析失败，记录错误并尝试下一个模型
          lastError = `parse_error(${model}): ${safeErrorText(parseErr.message)}`;
          continue;
        }
      }
      // 记录失败原因，尝试下一个模型
      lastError = result.error;
    }

    // 所有模型都失败，降级为启发式提取，并附带错误信息
    sendJson(res, 200, {
      structured: heuristicExtract(text),
      source: "heuristic_fallback",
      ai_error: lastError,
    });
  } catch (error) {
    // 顶层异常兜底，避免未处理异常导致进程崩溃
    sendJson(res, 500, { error: "结构化提取失败", detail: safeErrorText(error.message) });
  }
};

// 调用 SiliconFlow API，返回 { ok, content, error }
async function callSiliconFlow(apiKey, model, prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(SILICON_FLOW_URL, {
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
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const raw = await response.text();
    if (!response.ok) {
      return { ok: false, content: "", error: `http_${response.status}: ${safeErrorText(raw).slice(0, 200)}` };
    }
    const payload = JSON.parse(raw);
    const content = payload.choices?.[0]?.message?.content || "{}";
    return { ok: true, content, error: "" };
  } catch (error) {
    clearTimeout(timeout);
    return { ok: false, content: "", error: `${error.name || "Unknown"}: ${safeErrorText(error.message)}` };
  }
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

  // 分类兜底纠正：基于物品名称关键词重新判断
  let category = pickEnum(data.category, CATEGORIES, "其他");
  category = recategorizeByTitle(title, originalText, category);

  // 地点结构化
  const district = pickEnum(data.district, Object.keys(STREET_DATA), "");
  const street = String(data.street || "").slice(0, 40);
  const detailLocation = String(data.detail_location || "").slice(0, 60);

  return {
    type,
    title,
    category,
    color: pickEnum(data.color, COLORS, "黑色"),
    location: String(data.location || "未知地点").slice(0, 60),
    district,
    street,
    detail_location: detailLocation,
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
  const colorWords = [
    "黑色", "白色", "红色", "蓝色", "绿色", "黄色", "紫色", "橙色", "粉色", "灰色", "棕色", "银色", "金色", "彩色", "透明", "米色", "青色",
    "深蓝", "浅蓝", "深灰", "浅灰", "玫红", "藏青", "香槟", "咖啡", "墨绿", "天蓝", "宝蓝", "深蓝色", "浅蓝色", "深灰色", "浅灰色", "玫红色", "藏青色", "香槟色", "咖啡色", "墨绿色", "天蓝色", "宝蓝色",
  ];
  for (const cp of colorWords) {
    if (title.startsWith(cp) && title.length > cp.length + 1) {
      title = title.slice(cp.length);
      break;
    }
  }
  // 去除动作词和量词前缀（按长度降序，优先匹配更长的前缀）
  const prefixes = [
    "我的", "丢了", "捡到", "拾到", "捡了", "拾了", "发现", "看到一个", "看到一个", "掉了", "不见", "找到", "一个是",
    "在", "一个", "個", "了", "和", "的", "是", "有", "个", "一",
  ];
  for (const prefix of prefixes) {
    if (title.startsWith(prefix) && title.length > prefix.length + 1) {
      title = title.slice(prefix.length);
      break;
    }
  }
  // 去除可能残留的"色"字开头
  title = title.replace(/^[色]\s*/, "");
  // 再去除可能残存的连接词
  title = title.trim().replace(/^(?:的|是|有|个|了|和)\s*/, "").trim();
  return title;
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
function parseTime(text) {
  const now = new Date();
  // 辅助：构造指定日期的 ISO 字符串（本地时区）
  const toIso = (date, hour, minute) => {
    const d = new Date(date);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString().slice(0, 16);
  };

  // 日期基准判断
  let baseDate = now;
  const hasYesterday = /昨天|昨日/.test(text);
  const hasToday = /今天|今日/.test(text);
  const hasDayBefore = /前天|前日/.test(text);

  if (hasYesterday) {
    baseDate = new Date(now);
    baseDate.setDate(baseDate.getDate() - 1);
  } else if (hasDayBefore) {
    baseDate = new Date(now);
    baseDate.setDate(baseDate.getDate() - 2);
  } else if (hasToday) {
    baseDate = now;
  } else {
    // 尝试匹配 "YYYY年M月D日" 完整日期格式
    const fullDateMatch = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})[日号]/);
    if (fullDateMatch) {
      const year = parseInt(fullDateMatch[1], 10);
      const month = parseInt(fullDateMatch[2], 10);
      const day = parseInt(fullDateMatch[3], 10);
      baseDate = new Date(year, month - 1, day);
    } else {
      // 尝试匹配 "X月X日" 格式
      const dateMatch = text.match(/(\d{1,2})月(\d{1,2})[日号]/);
      if (dateMatch) {
        const month = parseInt(dateMatch[1], 10);
        const day = parseInt(dateMatch[2], 10);
        const year = now.getFullYear();
        const parsed = new Date(year, month - 1, day);
        // 如果解析的日期在未来，则认为是去年
        if (parsed > now) parsed.setFullYear(year - 1);
        baseDate = parsed;
      } else {
        // 无明确日期，先检查"X点半"（避免被 timeMatch 误匹配为整点）
        const halfMatch = text.match(/(\d{1,2})点半/);
        if (halfMatch) {
          let hour = parseInt(halfMatch[1], 10);
          if (/下午|傍晚|晚上|夜间/.test(text) && hour <= 12) hour += 12;
          return toIso(now, hour, 30);
        }
        // 再尝试匹配具体时间，无则返回当前时间
        const timeMatch = text.match(/(\d{1,2})[点时:：](\d{0,2})/);
        if (timeMatch) {
          let hour = parseInt(timeMatch[1], 10);
          const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
          // 下午/晚上 + 数字 ≤ 6 → +12
          if (/下午|傍晚|晚上|夜间/.test(text) && hour <= 12) hour += 12;
          return toIso(now, hour, minute);
        }
        // 无时间信息，返回当前时间
        return now.toISOString().slice(0, 16);
      }
    }
  }

  // 统一处理"X点半"格式（半 = 30分），避免在各个时段分支中重复匹配
  const halfMatch = text.match(/(\d{1,2})点半/);
  if (halfMatch) {
    let hour = parseInt(halfMatch[1], 10);
    if (/下午|傍晚|晚上|夜间/.test(text) && hour <= 12) hour += 12;
    return toIso(baseDate, hour, 30);
  }

  // 时段判断
  if (/早上|早晨|清晨|上午/.test(text)) {
    // 上午：匹配具体小时，无则默认 8 点
    const timeMatch = text.match(/(\d{1,2})[点时:：](\d{0,2})/);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1], 10);
      const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      if (/下午|傍晚|晚上|夜间/.test(text) && hour <= 12) hour += 12;
      return toIso(baseDate, hour, minute);
    }
    return toIso(baseDate, 8, 0);
  }
  if (/中午/.test(text)) {
    const timeMatch = text.match(/(\d{1,2})[点时:：](\d{0,2})/);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1], 10);
      const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      if (hour <= 12) hour += 12;
      return toIso(baseDate, hour, minute);
    }
    return toIso(baseDate, 12, 0);
  }
  if (/下午|傍晚/.test(text)) {
    const timeMatch = text.match(/(\d{1,2})[点时:：](\d{0,2})/);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1], 10);
      const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      if (hour <= 12) hour += 12;
      return toIso(baseDate, hour, minute);
    }
    return toIso(baseDate, 15, 0);
  }
  if (/晚上|夜间|夜里/.test(text)) {
    const timeMatch = text.match(/(\d{1,2})[点时:：](\d{0,2})/);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1], 10);
      const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      if (hour <= 12) hour += 12;
      return toIso(baseDate, hour, minute);
    }
    return toIso(baseDate, 20, 0);
  }

  // 有日期但无时段，尝试匹配具体时间
  const timeMatch = text.match(/(\d{1,2})[点时:：](\d{0,2})/);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    if (/下午|傍晚|晚上|夜间/.test(text) && hour <= 12) hour += 12;
    return toIso(baseDate, hour, minute);
  }

  // 有日期但无具体时间，默认中午 12 点
  return toIso(baseDate, 12, 0);
}

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

  // 结构化地点解析
  let district = "";
  let street = "";
  let detailLocation = "";
  const districtMatch = location.match(/(东城区|西城区|朝阳区|丰台区|石景山区|海淀区|门头沟区|房山区|通州区|顺义区|昌平区|大兴区|怀柔区|平谷区|密云区|延庆区)/);
  if (districtMatch) {
    district = districtMatch[1];
    const possibleStreets = STREET_DATA[district] || [];
    for (const s of possibleStreets) {
      if (location.includes(s)) {
        street = s;
        break;
      }
    }
  }
  detailLocation = location.replace(district, "").replace(street, "").replace(/^[\s·-]+/, "").slice(0, 60);

  // 时间：使用 parseTime 解析"昨天下午3点"等表达，无时间信息时返回当前时间
  const parsedTime = parseTime(text);

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
    district,
    street,
    detail_location: detailLocation,
    time: parsedTime,
    contact,
    description: text.slice(0, 600),
    item_status,
    confidence: 0.4,
  };
}
