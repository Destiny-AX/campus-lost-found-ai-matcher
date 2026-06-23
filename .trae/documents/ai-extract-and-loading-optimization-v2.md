# AI 自动填写能力与失物广场加载优化计划

## 概述

基于对代码库的探索，回答用户的三个问题并制定优化方案：

1. **AI 时间解析能力**：AI 模式支持解析年月日；启发式 fallback 已支持"昨天/今天/X月X日"等格式（变更1已完成）
2. **地点/物品/具体位置解析**：AI 模式准确度高；启发式 fallback 物品名称和地点尚可，具体位置较弱
3. **失物广场加载慢**：主要瓶颈是后端 `syncSeedRecordsToSupabase`（每次请求 40-80 次串行 HTTP），次要瓶颈是前端 `extractImageFeatures`（Canvas 计算），无任何缓存

## 当前状态分析

### 已完成（变更1）
- `api/structured-input.js`：超时 25s、api_status 诊断字段、parseTime 函数（支持昨天/今天/前天 + 时段 + X月X日）

### 待优化问题

**后端瓶颈**（`api/records.js`）：
- 第 1337 行：`handleList` 每次请求都调用 `syncSeedRecordsToSupabase(config)`
- `syncSeedRecordsToSupabase`（第 1391-1493 行）：遍历 40 条种子数据，每条 1-2 次 HTTP = 40-80 次串行跨境请求
- 第 1349-1353 行：临时过滤 `city === "上海市"` 的旧数据

**前端瓶颈**（`script.js`）：
- 第 609 行：`hydrateRecord` 对每条 `imageFeature` 为空的记录调用 `extractImageFeatures`
- 第 2310-2331 行：`extractImageFeatures` 执行 Canvas 图像处理（缩放 32×32、直方图、感知哈希）
- 无 localStorage 缓存，每次刷新都重新请求 + 计算

**安全验证**：
- `compareImages`（第 2257-2260 行）已处理 null：`if (!a || !b) return 0.25;`
- 懒加载不会破坏匹配逻辑，只会降低图片匹配分（从计算值降为默认 0.25）

## 变更清单

### 变更2：移除后端同步逻辑 + 新增手动同步入口

**文件**：`api/records.js`

**修改1**：移除 `handleList` 中的自动同步调用
- 第 1337-1338 行：删除 `const syncResult = await syncSeedRecordsToSupabase(config);` 和 `console.log`
- 保留 `syncSeedRecordsToSupabase` 函数定义（第 1391-1493 行），供手动触发使用

**修改2**：新增 `action=sync-seeds` 手动同步入口
- 在第 1312 行 `if (action === "report")` 后新增：
```javascript
if (action === "sync-seeds") return await handleSyncSeeds(req, res);
```
- 新增 `handleSyncSeeds` 函数：
```javascript
async function handleSyncSeeds(req, res) {
  const config = getSupabaseConfig();
  if (!config) {
    sendJson(res, 503, { error: "数据库服务未配置" });
    return;
  }
  try {
    const result = await syncSeedRecordsToSupabase(config);
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    sendJson(res, 500, { error: "同步失败", detail: safeErrorText(error.message) });
  }
}
```

**修改3**：移除上海市数据过滤逻辑（待旧数据清理后）
- 第 1349-1353 行：删除 `filteredRows` 过滤逻辑
- 第 1354 行：直接使用 `rows` 而非 `filteredRows`
- **注意**：此修改在变更6（旧数据清理）执行后才生效

### 变更3：前端 localStorage 缓存（30 秒 TTL）

**文件**：`script.js`

**修改1**：新增缓存工具函数（在 `fetchPersistedRecords` 前）
```javascript
const RECORDS_CACHE_KEY = "shixun_records_cache";
const RECORDS_CACHE_TTL = 30000; // 30秒

function getRecordsCache() {
  try {
    const cached = localStorage.getItem(RECORDS_CACHE_KEY);
    if (!cached) return null;
    const { timestamp, records } = JSON.parse(cached);
    if (Date.now() - timestamp > RECORDS_CACHE_TTL) return null;
    return records;
  } catch (e) { return null; }
}

function setRecordsCache(records) {
  try {
    localStorage.setItem(RECORDS_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), records }));
  } catch (e) { /* localStorage 满或不可用，静默 */ }
}

function clearRecordsCache() {
  try { localStorage.removeItem(RECORDS_CACHE_KEY); } catch (e) { /* 静默 */ }
}
```

**修改2**：`fetchPersistedRecords` 增加缓存逻辑（第 617-625 行）
```javascript
async function fetchPersistedRecords() {
  // 1. 先检查缓存
  const cached = getRecordsCache();
  if (cached) return cached;
  // 2. 发起网络请求
  try {
    const response = await fetch("/api/records", { headers: authHeaders() });
    if (!response.ok) return [];
    const payload = await response.json();
    const list = Array.isArray(payload.records) ? payload.records.filter(Boolean) : [];
    const hydrated = await Promise.all(list.map(hydrateRecord));
    // 3. 写入缓存
    setRecordsCache(hydrated);
    return hydrated;
  } catch (e) { return []; }
}
```

**修改3**：在所有修改记录的地方清除缓存
- 第 1358 行前（标记归还后）：`clearRecordsCache();`
- 第 1381 行前（确认完成后）：`clearRecordsCache();`
- 第 2125 行前（取件成功后）：`clearRecordsCache();`
- 第 1823-1842 行（发布新记录后）：在 `records.unshift(saved)` 后 `clearRecordsCache();`

### 变更4：懒加载图片特征提取

**文件**：`script.js`

**修改1**：`hydrateRecord` 跳过 `extractImageFeatures`（第 603-615 行）
```javascript
async function hydrateRecord(record) {
  try {
    const defaultSeed = { background: "#e8ecf0", primary: "#6b7280", secondary: "#9ca3af", shape: "card" };
    const seed = record.visualSeed || defaultSeed;
    const imageData = record.imageData || createSyntheticImage(seed, record.title);
    // 懒加载：已有 imageFeature 直接用，没有的设为 null，匹配时按需提取
    const imageFeature = record.imageFeature || null;
    return { ...record, imageData, imageFeature, semantic: record.semantic || buildFallbackSemantic(record) };
  } catch (e) {
    console.error("hydrateRecord 失败:", record.id, e);
    return { ...record, imageData: record.imageData || "", imageFeature: null, semantic: record.semantic || buildFallbackSemantic(record) };
  }
}
```

**修改2**：新增按需提取函数 `ensureImageFeature`
```javascript
// 按需提取图片特征（匹配时调用，避免初始加载时全量计算）
async function ensureImageFeature(record) {
  if (record.imageFeature) return record.imageFeature;
  if (!record.imageData) return null;
  const feature = await extractImageFeatures(record.imageData);
  record.imageFeature = feature; // 缓存到记录对象上，避免重复计算
  return feature;
}
```

**修改3**：在匹配逻辑中按需提取（第 2213 行附近）
- 找到 `compareImages(a.imageFeature, b.imageFeature)` 的调用处
- 在匹配前先调用 `ensureImageFeature` 确保特征已提取
- **注意**：由于 `compareImages` 已处理 null（返回 0.25），此修改为可选优化，优先保证不破坏现有逻辑

### 变更5：增强 parseTime 支持完整日期格式（可选）

**文件**：`api/structured-input.js`

**修改**：在 `parseTime` 函数（第 379-482 行）中增加"2026年6月5日"格式支持
- 在日期基准判断部分（第 407-418 行的 `dateMatch` 后）新增：
```javascript
// 支持"2026年6月5日"格式
const fullDateMatch = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})[日号]/);
if (fullDateMatch) {
  const year = parseInt(fullDateMatch[1], 10);
  const month = parseInt(fullDateMatch[2], 10);
  const day = parseInt(fullDateMatch[3], 10);
  baseDate = new Date(year, month - 1, day);
}
```

- 在具体时间匹配部分增加"X点半"支持：
```javascript
// 支持"3点半""3点30"等
const halfMatch = text.match(/(\d{1,2})点半/);
if (halfMatch) {
  let hour = parseInt(halfMatch[1], 10);
  if (/下午|傍晚|晚上|夜间/.test(text) && hour <= 12) hour += 12;
  return toIso(baseDate, hour, 30);
}
```

### 变更6：旧数据清理（一次性操作）

**前提**：Vercel 部署成功，`/api/migrate-city` 可用

**步骤**：
1. 调用 `/api/migrate-city` 清空 Supabase 中所有旧数据
2. 调用 `/api/records?action=sync-seeds` 重新同步北京种子数据
3. 验证 `/api/records` 返回的数据全部为北京市
4. 执行变更2的修改3（移除上海市过滤逻辑）

## 假设与决策

1. **缓存 TTL 30 秒**：平衡新鲜度和性能，用户手动刷新可跳过缓存（通过清除缓存实现）
2. **懒加载策略**：`hydrateRecord` 不再调用 `extractImageFeatures`，匹配时 `compareImages` 对 null 返回默认分 0.25，不影响功能正确性
3. **手动同步入口**：保留 `syncSeedRecordsToSupabase` 函数，通过 `action=sync-seeds` 手动触发，新环境首次部署时调用一次
4. **旧数据清理**：纳入本次计划，一次性清理后移除过滤逻辑
5. **增强时间解析**：作为可选项，AI 模式已覆盖所有格式，增强只对 fallback 有效

## 验证步骤

### 变更2 验证
1. 访问 `/api/records`，确认不再有 `[LIST] Sync result` 日志
2. 确认响应时间显著降低（从 5-10 秒降到 1-2 秒）
3. 调用 `/api/records?action=sync-seeds`，确认手动同步正常工作

### 变更3 验证
1. 首次加载失物广场，记录列表正常显示
2. 30 秒内再次访问，瞬间显示（从缓存读取）
3. 发布新记录后，缓存被清除，下次加载获取最新数据

### 变更4 验证
1. 失物广场加载速度进一步提升（无 Canvas 计算）
2. 点击"以图搜图"或匹配时，功能正常（`compareImages` 处理 null）
3. 匹配结果中图片分为 0.25（默认值），不影响整体匹配

### 变更5 验证（如执行）
1. 输入"2026年6月5日下午3点"，启发式 fallback 正确解析为 `2026-06-05T15:00`
2. 输入"3点半"，正确解析为 `XX:30`

### 变更6 验证
1. 调用 `/api/migrate-city` 后，Supabase 中无旧数据
2. `/api/records` 返回的记录全部为北京市
3. 移除过滤逻辑后，功能正常

## 实施顺序

1. 变更2（移除同步逻辑 + 手动同步入口）— 后端，最大收益
2. 变更3（前端缓存）— 前端，减少重复请求
3. 变更4（懒加载图片特征）— 前端，减少 Canvas 计算
4. 变更5（增强时间解析，可选）— 后端，提高 fallback 覆盖率
5. 变更6（旧数据清理）— 部署后执行
6. 提交并推送到 GitHub
7. 验证功能正常

## 预期效果

- 失物广场加载时间：5-10 秒 → 1-2 秒（首次）/ 瞬间（缓存命中）
- AI 自动填写：时间/地点/物品名称解析准确（AI 模式），fallback 模式覆盖常见表达
- 数据一致性：清理旧上海数据，移除临时过滤逻辑
