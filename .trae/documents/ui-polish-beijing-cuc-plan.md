# UI 美化与地域调整计划

## 摘要
基于用户要求，完成以下 5 项前端改进：
1. 美化搜索组件样式（已完成，需确认完整性）
2. 美化 AI 匹配界面（HTML 结构已改，CSS 缺失）
3. 给拾小寻增加 FAQ（已完成）
4. 登录简化为单用户演示实例（已完成）
5. 地域调整为北京市，默认筛选朝阳区+中国传媒大学（已完成，需补充默认选中逻辑）

## 当前状态分析

### 已完成的变更
- `STREET_DATA` 已改为北京市 16 区，朝阳区包含"三间房街道"和"中国传媒大学"
- `locationGroups` 已更新为北京地点邻接关系
- `autoLoginDemo()` 自动以"拾小寻"昵称静默登录
- `MASCOT_FAQ` 8 条 FAQ 数据已添加，支持手风琴交互
- 搜索组件 v2 样式（`.search-box`、`.filter-chips`、`.location-select-wrap`、`.active-filters`）已添加到 style.css
- `renderMatchItem()` 已添加 SVG 环形进度条和彩色维度条形图 HTML 结构

### 待完成的变更
- **AI 匹配界面 CSS 缺失**：`renderMatchItem()` 中使用了 `.match-score-ring`、`.match-dimensions`、`.match-dimension`、`.match-recommend`、`.match-item-media`、`.match-item-body`、`.ring-bg`、`.ring-fill`、`.dim-bar`、`.dim-fill` 等类名，但 style.css 中仅有 `.match-item` 的基础样式（L469-474），缺少环形进度条、维度条形图、强烈推荐标签等样式。
- **默认筛选逻辑缺失**：页面加载后未自动选中"朝阳区"和"中国传媒大学"，需要修改初始化逻辑。

## 拟议变更

### 变更 1：为 AI 匹配界面添加完整 CSS 样式
**文件**：`style.css`
**位置**：在 `.match-item` 样式区域（约 L468-479）之后插入
**内容**：
- `.match-item-media`：左侧媒体区，相对定位，容纳图片和环形进度条
- `.match-score-ring`：SVG 环形进度条容器，绝对定位在图片右下角
  - `.ring-bg`：灰色背景环
  - `.ring-fill`：彩色进度环，使用 `stroke-dasharray` 动画
  - `.ring-text`：环中心百分比文字
- `.match-recommend`："🔥 强烈推荐"标签，红色渐变背景，白色文字
- `.match-item-body`：右侧内容区，flex 纵向布局
- `.match-dimensions`：维度条形图容器，2 列网格布局
- `.match-dimension`：单行维度，包含标签、进度条、数值
  - `.dim-label`：维度名称（类别、颜色、地点等）
  - `.dim-bar`：灰色底条
  - `.dim-fill`：彩色填充条，宽度由 CSS 变量 `--dim-width` 控制，颜色由 `--dim-color` 控制
  - `.dim-val`：百分比数值

### 变更 2：设置默认筛选为朝阳区+中国传媒大学
**文件**：`script.js`
**位置**：`init()` 函数或 `renderLocationStreets()` 之后
**内容**：
- 页面初始化时，设置 `els.filterDistrict.value = "朝阳区"`
- 触发 `renderLocationStreets()` 更新街道下拉列表
- 设置 `els.filterStreet.value = "中国传媒大学"`
- 调用 `renderItemList()` 应用筛选
- 确保筛选标签正确显示在 `.active-filters` 中

### 变更 3：代码自检与部署
**步骤**：
1. 运行 `python run_tests.py` 执行 Playwright 端到端测试
2. 检查浏览器控制台是否有 CSS/JS 错误
3. 提交 git：`git add -A && git commit -m "feat: 美化AI匹配界面，默认筛选传媒大学"`
4. 部署到 Vercel：`vercel --prod`

## 假设与决策
- 采用现代卡片式风格（用户已确认）
- 默认筛选朝阳区+中国传媒大学（用户已确认）
- 环形进度条使用 SVG stroke-dasharray 实现，无需额外库
- 维度条形图使用 CSS Grid 2 列布局，适配移动端

## 验证步骤
1. 打开首页，确认搜索组件样式正常
2. 确认筛选默认显示"📍 朝阳区"和"🏘️ 中国传媒大学"标签
3. 确认物品列表仅显示传媒大学相关物品
4. 进入 AI 匹配页面，确认匹配卡片显示环形进度条和 6 个维度条形图
5. 点击拾小寻头像，确认 FAQ 手风琴正常展开/收起
6. 确认未登录时自动显示"拾小寻"已登录状态
7. 运行测试脚本，确认 36 项测试全部通过
