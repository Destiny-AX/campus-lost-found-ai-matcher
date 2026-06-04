# AI 提示词优化计划：精准提取与整体重构

## 摘要

用户质疑当前 AI 提示词优化未完全实现，特别是 title 精准提取（如"黑色一加耳机"→"一加耳机"）。经代码审查，现有实现已有基础规则但不够严格。本计划对 `api/structured-input.js` 进行整体提示词重构，采用 few-shot 示例、严格约束格式和更精准的启发式 fallback，确保 AI 和本地 fallback 都能精准提取物品名称、联系方式和地点。

## 当前状态分析

### 已实现的优化（现有代码）

1. **SYSTEM_PROMPT 中的 title 规则**（`structured-input.js` 第 107-122 行）：
   - 已有 `"title": 只提取物品名称本身，不要包含地点、时间、动作等冗余信息`
   - 已有示例：`"黑色一加耳机"→"一加耳机"`、`"蓝色校园卡套"→"校园卡套"`
   - 但规则分散在长篇 prompt 中，AI 可能忽略

2. **heuristicExtract 中的 title 提取**（第 241-292 行）：
   - 使用 `indexOf` 精确匹配关键词位置，避免正则贪婪匹配
   - 按关键词长度降序排序，优先匹配更长关键词
   - 清理颜色词前缀（如"黑色"、"蓝色"）
   - 但清理逻辑有漏洞：可能残留"色"字前缀

3. **contact 提取**（第 294-317 行）：
   - 支持公共机构识别（派出所、地铁站等）
   - 有清理动词前缀逻辑：`contact.replace(/^(?:已联系|联系|已交给|交给|给|送到|送至|交至|交到|已送|在)\s*/, "")`
   - 但正则匹配机构名时前面限定 `\u4e00-\u9fa5{0,5}` 仍可能包含多余词

### 存在的问题

1. **SYSTEM_PROMPT 结构松散**：规则以长文本段落呈现，AI 容易忽略关键约束
2. **few-shot 示例不足**：仅 2 个 title 示例，缺少完整的 JSON 输出示例
3. **heuristicExtract 颜色清理有 bug**：第 290 行 `title.replace(/^[色红蓝绿黄紫橙粉灰棕银金彩青]\s*/, "")` 会误删合法标题开头的字（如"金色手表"→"手表"正确，但"红领巾"→"领巾"错误）
4. **location 提取未清理动作词**：如"在传媒大学图书馆捡到一个蓝色校园卡套"提取到"传媒大学图书馆"，但"丢在食堂门口"可能提取到"食堂门口"（含"门口"）
5. **contact 提取仍可能包含多余词**：如"已联系南京东路派出所"可能提取到"联系南京东路派出所"

## 拟议变更

### 文件 1: `api/structured-input.js`

#### 变更 1.1: 重写 buildPrompt 函数（第 103-129 行）

**What**: 将松散文本规则重构为结构化 few-shot prompt

**Why**: 
- 当前 prompt 是长段落，AI 容易忽略关键约束
- 增加完整的输入→输出示例，让 AI 明确学习提取模式
- 将 title 规则前置并加粗强调

**How**:
```javascript
function buildPrompt(text) {
  return [
    "你是一位专业的失物招领信息提取助手。请从用户描述中精准提取关键信息，输出严格 JSON。",
    "",
    "## 提取规则（按优先级排序）",
    "",
    "### 1. title（最重要）",
    "- 只提取物品名称本身，绝对不要包含地点、时间、动作、状态等冗余信息",
    "- 去除所有修饰词：颜色、数量、大小、新旧等",
    "- 错误示例：\"黑色一加耳机\" → 不要输出\"黑色一加耳机\"，正确输出：\"一加耳机\"",
    "- 错误示例：\"在图书馆捡到一个蓝色校园卡套\" → 不要输出整句话，正确输出：\"校园卡套\"",
    "- 错误示例：\"丢了身份证\" → 正确输出：\"身份证\"",
    "- 控制在 15 字以内，优先使用常见物品名称",
    "",
    "### 2. type",
    `- "lost": 出现"丢""遗失""掉了""找不到""不见了"`,
    `- "found": 出现"捡到""拾到""捡了""拾了""发现"`,
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
    "- 错误示例：\"在传媒大学图书馆\" → 正确：\"传媒大学图书馆\"",
    "",
    "### 6. time",
    "- 解析相对时间并转换为 ISO 8601 格式（YYYY-MM-DDTHH:mm）",
    "- 昨天下午3点 = 昨天日期 15:00",
    "",
    "### 7. contact",
    "- 个人：提取手机号/微信号",
    `- 公共机构（派出所/地铁站/机场等）：填写"机构名称 + 电话"，如"南京东路派出所 021-63170110"`,
    "- 去除动词前缀：\"已联系\"\"交给\"\"送到\"等",
    "- 错误示例：\"已联系地铁站服务台\" → 正确：\"地铁站服务台\"",
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
```

#### 变更 1.2: 修复 heuristicExtract 中的 title 清理逻辑（第 279-290 行）

**What**: 修复颜色词清理逻辑，避免误删合法标题开头的字

**Why**: 当前 `title.replace(/^[色红蓝绿黄紫橙粉灰棕银金彩青]\s*/, "")` 会错误删除"红领巾"→"领巾"

**How**:
```javascript
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
  
  // 去除可能残留的"色"字（仅当前面是颜色相关字时）
  title = title.replace(/^[色]\s*/, "");
  
  // 最终清理：去除首尾空白和常见连接词
  title = title.trim().replace(/^(?:的|是|有|个|一|了|和)\s*/, "").trim();
```

#### 变更 1.3: 优化 location 提取（第 233-235 行）

**What**: 改进地点提取正则，去除"在""丢在""捡到"等动作词前缀

**Why**: 当前正则 `在([^，。,.！？!?；;：:]{2,25}?)` 保留"在"字后面的内容，但可能包含"丢在""捡到"等词

**How**:
```javascript
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
```

#### 变更 1.4: 优化 contact 提取（第 294-317 行）

**What**: 增强公共机构联系方式提取，更严格地清理动词前缀

**Why**: "已联系南京东路派出所"当前可能提取到"联系南京东路派出所"

**How**:
```javascript
  // 公共机构联系方式提取
  const institutionNames = ["派出所", "地铁站", "地铁", "机场", "失物招领中心", "服务中心", "物业", "值班室", "服务台", "游客中心", "图书馆", "学校", "大学", "公安局", "警务站"];
  let contact = "";
  const hasInstitution = institutionNames.some((name) => lower.includes(name));
  if (hasInstitution) {
    // 策略1：匹配 "XX机构 + 电话 + 号码"
    const contactMatch = text.match(/([\u4e00-\u9fa5]{0,5}(?:派出所|地铁站|机场|服务中心|物业|值班室|服务台|游客中心|图书馆|公安局))[^\u4e00-\u9fa5]{0,5}[，。,.\s]*(?:电话|联系方式|联系|热线)?[：:]?\s*(\d{3,4}-?\d{6,8}|1\d{10})/);
    if (contactMatch) {
      contact = contactMatch[1].trim();
      if (contactMatch[2]) contact += " " + contactMatch[2].trim();
    } else {
      // 策略2：只提取机构名（限定前面最多5个汉字）
      const instMatch = text.match(/([\u4e00-\u9fa5]{0,5}(?:派出所|地铁站|机场|服务中心|物业|值班室|服务台|游客中心|图书馆|公安局))/);
      if (instMatch) contact = instMatch[1].trim();
    }
  }
  
  // 严格清理联系方式中的动词前缀
  const verbPrefixes = ["已联系", "联系", "已交给", "交给", "给", "送到", "送至", "交至", "交到", "已送", "在", "已通知", "通知", "已告知", "告知", "已转交", "转交"];
  for (const prefix of verbPrefixes) {
    if (contact.startsWith(prefix)) {
      contact = contact.slice(prefix.length).trim();
      break;
    }
  }
```

#### 变更 1.5: 优化 normalizeStructured 中的 title 二次校验（第 131-167 行）

**What**: 在 AI 返回结果后，对 title 进行二次清理

**Why**: 即使提示词优化，AI 仍可能返回不理想的 title

**How**:
```javascript
  // 二次清理 title：确保没有颜色词、动作词残留
  let title = String(data.title || "").slice(0, 60);
  title = cleanTitle(title);

  // ...

function cleanTitle(title) {
  if (!title) return "";
  // 去除颜色前缀
  const colorPrefixes = ["黑色", "白色", "红色", "蓝色", "绿色", "黄色", "紫色", "橙色", "粉色", "灰色", "棕色", "银色", "金色", "彩色", "透明", "米色", "青色"];
  for (const cp of colorPrefixes) {
    if (title.startsWith(cp) && title.length > cp.length) {
      title = title.slice(cp.length);
      break;
    }
  }
  // 去除动作词前缀
  title = title.replace(/^(?:丢了|捡到|拾到|捡了|拾了|发现|看到一个|掉了|不见|找到|在|一个|個|了|和|的|是|有|个|一)\s*/, "");
  // 去除首尾空白
  return title.trim();
}
```

### 文件 2: `script.js`（可选微调）

#### 变更 2.1: AI 填表后的反馈优化（第 403 行附近）

**What**: 在 AI 填表成功后，如果 title 包含明显异常（超过15字或包含"在""丢了"等词），给用户提示

**Why**: 让用户知道 AI 提取可能不准确，需要人工核对

**How**:
```javascript
    // 检查 title 质量
    if (s.title && (s.title.length > 15 || /^(?:在|丢了|捡到|一个)/.test(s.title))) {
      showToast(`AI 已自动填表，但 title "${s.title}" 可能需要手动修正`, "warning");
    } else {
      showToast(`AI 已自动填表（置信度 ${Math.round(s.confidence * 100)}%，来源：${payload.source}）`, "success");
    }
```

## 假设与决策

1. **保持 Base64 图片存储**：用户已明确选择简单方案，不引入 Supabase Storage
2. **AI 模型不变**：继续使用 `Qwen/Qwen3-8B` 或环境变量配置的模型
3. **heuristic fallback 保留**：即使 API Key 存在，网络失败时仍走本地提取
4. **不引入新依赖**：仅修改现有代码逻辑，不添加 npm 包
5. **向后兼容**：现有 API 响应格式不变，仅优化内部提取质量

## 验证步骤

1. **本地测试 heuristicExtract**：
   ```javascript
   // 测试用例
   heuristicExtract("黑色一加耳机") // 期望: "一加耳机"
   heuristicExtract("在传媒大学图书馆捡到一个蓝色校园卡套") // 期望: "校园卡套"
   heuristicExtract("已联系南京东路派出所") // 期望 contact: "南京东路派出所"
   heuristicExtract("丢在食堂门口") // 期望 location: "食堂门口"
   ```

2. **API 测试（如有 API Key）**：
   ```bash
   curl -X POST http://localhost:3000/api/structured-input \
     -H "Content-Type: application/json" \
     -d '{"text":"昨天下午在人民广场地铁站捡到一个黑色一加耳机，已交给服务台"}'
   ```
   期望返回：`title: "一加耳机"`, `location: "人民广场地铁站"`, `contact: "人民广场地铁站服务台"`

3. **端到端测试**：
   - 打开发布页面
   - 在 AI 输入框输入："黑色一加耳机丢了"
   - 点击"让 AI 自动填表"
   - 验证 title 字段为"一加耳机"（不是"黑色一加耳机"）

4. **回归测试**：
   - 确保现有功能（发布、列表、匹配、删除）不受影响
   - 确保 Base64 图片上传和显示正常
