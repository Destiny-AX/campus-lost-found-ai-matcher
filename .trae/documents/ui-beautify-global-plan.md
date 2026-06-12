# 拾寻全局视觉风格升级计划

## 摘要
基于代码库全面探索，当前界面在以下方面仍有提升空间：
1. **色彩系统单一**：仅有基础蓝/绿/红/橙，缺少层次感和品牌辨识度
2. **字体层级混乱**：标题、正文、辅助文字大小对比不够鲜明
3. **卡片/列表视觉疲劳**：`card-grid` 采用分割线布局，缺少呼吸感
4. **发布表单陈旧**：城市选择仍显示"上海市"，区/县选项也是上海数据
5. **交互动效缺失**：按钮点击、页面切换、加载状态等缺少精致微动效
6. **空状态/异常状态简陋**：`empty-state` 仅有文字，缺少视觉引导
7. **Inspector 右侧栏空洞**：当前无实际内容，浪费空间

## 当前状态分析

### 已探索的关键文件
- `index.html`：发布表单中城市/区/县选择器仍使用上海市数据（L262-285）
- `style.css`：
  - `:root` 仅定义了基础 4 色 + 中性色，缺少品牌渐变色、表面色层级
  - `.card-grid` 使用 `gap: 0` + `border-bottom` 分割线布局（L212-220）
  - `.stats-bar` 已有渐变顶部装饰线，但整体仍偏平淡
  - 动效仅有基础的 `cardEnter` 和 `dialogIn`，缺少按钮涟漪、悬浮放大等
- `script.js`：
  - `renderRecordCard()` 生成卡片 HTML，结构固定
  - `renderProfile()` 个人页面结构简单
  - `showToast()` 通知已有基础动效

### 用户决策
- **优先全局视觉风格升级**（而非单页面或动效）
- **不增加深色模式**，专注优化现有浅色主题

## 拟议变更

### 变更 1：升级色彩系统（style.css）
**文件**：`style.css`
**位置**：`:root` 区域（L5-20）
**内容**：
- 增加品牌渐变色：`--brand-gradient: linear-gradient(135deg, #0071e3, #5e5ce6)`
- 增加表面色层级：`--surface-1: #ffffff`, `--surface-2: #f5f5f7`, `--surface-3: #e8e8ed`
- 增加文字层级：`--text-primary: #1d1d1f`, `--text-secondary: #6e6e73`, `--text-tertiary: #aeaeb2`
- 增加成功/警告/错误软色：`--green-soft: rgba(52,199,89,0.08)`, `--orange-soft: rgba(255,149,0,0.08)`, `--red-soft: rgba(255,59,48,0.08)`
- 统一替换所有使用旧变量的地方

### 变更 2：优化卡片网格布局（style.css + script.js）
**文件**：`style.css`, `script.js`
**位置**：`.card-grid`（L212-220）、`renderRecordCard()`
**内容**：
- `.card-grid` 改为 `gap: 16px`，去掉 `border-bottom` 分割线
- `.card` 增加圆角阴影：`border-radius: var(--radius)`、`box-shadow: var(--shadow)`
- 卡片悬浮效果增强：`transform: translateY(-4px)` + `box-shadow: var(--shadow-lg)` + 边框高亮
- `renderRecordCard()` 中优化信息层级：图片置顶、标题加粗、元信息使用 pill 标签紧凑排列

### 变更 3：修复发布表单地域数据（index.html）
**文件**：`index.html`
**位置**：发布表单城市/区选择器（L260-285）
**内容**：
- 城市默认值改为"北京市"
- 区/县选项改为北京市 16 区（与 `STREET_DATA` 一致）
- 街道级联逻辑通过现有 `bindLocationCascade()` 自动适配

### 变更 4：增强按钮与交互反馈（style.css）
**文件**：`style.css`
**位置**：Buttons 区域（L281-339）
**内容**：
- `.primary-action` 增加渐变背景：`background: var(--brand-gradient)`
- 所有可点击元素增加 `:active` 缩放反馈：`transform: scale(0.97)`
- 增加按钮涟漪效果（CSS `:after` 伪元素 + `@keyframes ripple`）
- `.chip`、`.filter-chip` 增加悬浮背景色过渡

### 变更 5：美化空状态与加载状态（style.css + script.js）
**文件**：`style.css`, `script.js`
**位置**：`.empty-state`（L862-869）、加载相关逻辑
**内容**：
- `.empty-state` 增加插画风格 SVG 图标（放大镜 + 问号）
- 增加骨架屏 `.skeleton` 样式优化，用于列表加载占位
- `renderItemList()` 在数据加载前显示骨架屏

### 变更 6：优化 Inspector 右侧栏（index.html + style.css + script.js）
**文件**：`index.html`, `style.css`, `script.js`
**位置**：`.inspector`（L83-91）、`renderStats()`
**内容**：
- Inspector 增加实际内容：当前筛选摘要、热门标签云、快速操作按钮
- `renderStats()` 或新增 `renderInspector()` 函数动态渲染右侧栏
- 移动端下 Inspector 隐藏或变为可折叠面板

### 变更 7：统一字体层级与间距（style.css）
**文件**：`style.css`
**位置**：全局
**内容**：
- 定义字体层级变量：`--text-xs: 11px`, `--text-sm: 13px`, `--text-base: 14px`, `--text-lg: 16px`, `--text-xl: 20px`, `--text-2xl: 28px`
- 统一标题、正文、辅助文字使用对应层级
- 优化段落间距和组件内边距，增加呼吸感

### 变更 8：移动端专项优化（style.css + index.html）
**文件**：`style.css`, `index.html`
**位置**：Responsive 区域（L1208-1251）、移动端相关结构
**内容**：
- **搜索组件**：移动端下搜索框改为全宽，filter-chips 支持横向滑动（`overflow-x: auto` + `white-space: nowrap` + 隐藏滚动条）
- **卡片网格**：移动端保持单列但增加卡片内边距和圆角，图片改为全宽 `aspect-ratio: 16/10`
- **底部导航**：增加选中态背景指示器（小圆点或上边框高亮），图标尺寸统一
- **Inspector 适配**：移动端 Inspector 完全隐藏，关键信息（如筛选摘要）移至内容区顶部或折叠面板
- **弹窗适配**：`detail-dialog` / `login-dialog` 在移动端下宽度改为 `100%` + 底部滑出动画（`translateY(100%) → translateY(0)`），替代居中缩放
- **触摸反馈**：移动端所有可点击元素增加 `-webkit-tap-highlight-color: transparent` 和 `:active` 状态色块反馈，替代 hover 效果
- **字体适配**：移动端标题适当缩小（`top-bar h2` 28px → 22px），正文保持 14px 确保可读性
- **安全区适配**：底部 tab 栏已使用 `env(safe-area-inset-bottom)`，需确认顶部状态栏区域也有适配

## 假设与决策
- 不引入新依赖（如图标库、动画库），全部使用 CSS/SVG 实现
- 保持现有布局结构（三栏 grid），不改动大框架
- 色彩升级向后兼容，逐步替换旧变量
- 发布表单地域数据与前端 `STREET_DATA` 保持一致

## 验证步骤
1. 打开首页，确认卡片网格有间距和阴影，悬浮有效果
2. 确认搜索/筛选后卡片正确渲染，无样式错乱
3. 进入发布页面，确认城市默认为北京，区/县选项为北京16区
4. 确认按钮点击有缩放反馈，主按钮为渐变蓝色
5. 清空筛选条件，确认空状态显示新插画图标
6. 确认右侧 Inspector 显示筛选摘要和热门标签
7. 运行 Playwright 测试，确认无功能性回归
