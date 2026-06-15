# 移动端横向压缩 & 底部导航遮挡 修复计划

## 问题描述
1. **横向压缩**：手机浏览器打开后，页面内容被限制在窄区域，两边有大面积空白，像桌面版缩小
2. **底部导航遮挡**：`.app-shell` 和 `.content` 的 `padding-bottom` 叠加导致底部空白过大

## 根因分析

### 根因1：横向宽度 —— `.app-shell` 默认 `overflow-x: hidden` 缺失 + 可能的浏览器缓存

当前 `body` 有 `overflow-x: hidden`，但 `body` 和 `html` 没有 `width: 100%` 显式声明。
虽然 `grid-template-columns: 1fr` 理论上应占满宽度，但若存在缓存未命中最新 CSS，手机浏览器可能使用桌面端 Grid 布局（3 列：220px + 1fr + 280px），导致主内容区实际可用宽度远小于屏幕宽度。

### 根因2：纵向遮挡 —— `padding-bottom` 双重叠加

```css
/* @media (max-width: 1024px) */
.app-shell  { padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px)); }  /* ← 第一层 */
.content    { padding-bottom: calc(90px + env(safe-area-inset-bottom, 0px)); }  /* ← 第二层 */
```

`.content` 是 `.app-shell` 的子元素，两层 `padding-bottom` 叠加 ≈ 154px + 2×safe-area，远超底部导航栏实际高度 56px，导致内容区过度缩小且底部大量空白。

### 根因3：`100vh` 在移动端不可靠

`100vh` 在移动浏览器中包含地址栏/底部栏高度，导致实际可见区域小于 CSS 计算的视口高度。新标准 `100dvh` 能正确反映动态视口高度。

---

## 修改计划

### 修改1：`style.css` —— 修复 `.app-shell` 和 `.content` 移动端样式

**文件**：`d:\Trae_Solo_Project\拾寻\style.css`

**改动点A** —— `@media (max-width: 1024px)` 块 (约第1344行)

改前：
```css
  .app-shell {
    grid-template-columns: 1fr;
    min-height: 100vh;
    min-height: -webkit-fill-available;
    padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
  }
  .content { padding: 16px 16px calc(90px + env(safe-area-inset-bottom, 0px)); max-width: 100%; }
  .bottom-tabs { display: flex; height: calc(56px + env(safe-area-inset-bottom, 0px)); }
```

改后：
```css
  .app-shell {
    grid-template-columns: 1fr;
    min-height: 100dvh;                          /* 使用动态视口高度，兼容移动浏览器 */
    min-height: -webkit-fill-available;
    width: 100%;                                 /* 显式确保全宽 */
    overflow-x: hidden;                          /* 防止横向溢出 */
  }
  .content {
    padding: 16px 16px calc(56px + env(safe-area-inset-bottom, 0px) + 8px);  /* 只保留一层 padding-bottom，匹配底部导航高度 */
    max-width: 100%;
    width: 100%;
    box-sizing: border-box;
  }
  .bottom-tabs { display: flex; }
```

**为什么这样改**：
- 删除 `.app-shell` 的 `padding-bottom`，消除双重叠加
- `.content` 的 `padding-bottom` 精确匹配 `.bottom-tabs` 实际高度（约 56px + safe-area + 8px 余量）
- 添加 `width: 100%` 和 `overflow-x: hidden` 到 `.app-shell`，防止任何宽度溢出
- 使用 `100dvh` 替代 `100vh`，正确适配动态视口

**改动点B** —— `@media (max-width: 480px)` 块 (约第1620行)

改前：
```css
  .content { padding: 12px 12px calc(90px + env(safe-area-inset-bottom, 0px)); }
```

改后：
```css
  .content { padding: 12px 12px calc(56px + env(safe-area-inset-bottom, 0px) + 8px); }
```

### 修改2：`style.css` —— 同步 `.bottom-tabs` 高度定义

**改动点C** —— `.bottom-tabs` 默认样式 (约第1311行)

将默认 `.bottom-tabs` 的 `padding` 固定为一致的高度基准，确保在所有场景下 `.content` 的 `padding-bottom` 和 `.bottom-tabs` 高度匹配。

改前：
```css
.bottom-tabs {
  display: none; position: fixed; bottom: 0; left: 0; right: 0;
  background: var(--glass); backdrop-filter: var(--glass-blur);
  border-top: 1px solid var(--border);
  padding: 6px 4px calc(6px + env(safe-area-inset-bottom, 0px));
  z-index: 100;
  justify-content: space-around;
  align-items: center;
}
```

改后：
```css
.bottom-tabs {
  display: none; position: fixed; bottom: 0; left: 0; right: 0;
  background: var(--glass); backdrop-filter: var(--glass-blur);
  border-top: 1px solid var(--border);
  padding: 6px 0 calc(6px + env(safe-area-inset-bottom, 0px));
  z-index: 100;
  justify-content: space-around;
  align-items: center;
  min-height: 56px;
  width: 100%;
  box-sizing: border-box;
}
```

### 修改3：`index.html` —— CSS 缓存失效

**改动点** —— CSS 版本号 (第8行)

改前：
```html
<link rel="stylesheet" href="style.css?v=2" />
```

改后：
```html
<link rel="stylesheet" href="style.css?v=3" />
```

确保手机浏览器加载最新 CSS，不使用旧缓存。

### 修改4：`style.css` —— 确保 html/body 全宽

**改动点D** —— 在 `body` 选择器附近添加：

在 `body` 样式块添加 `width: 100%`：
```css
body {
  ...
  overflow-x: hidden;
  width: 100%;
}
```

同时添加：
```css
html {
  width: 100%;
  overflow-x: hidden;
}
```

---

## 修改清单

| 文件 | 行范围 | 改动内容 |
|------|--------|----------|
| `style.css` | ~L36-41 (body) | 添加 `width: 100%` 到 body；新增 `html { width: 100%; overflow-x: hidden; }` |
| `style.css` | ~L1310-1316 (.bottom-tabs) | 移除左右多余 padding，添加 `min-height: 56px; width: 100%; box-sizing: border-box;` |
| `style.css` | ~L1344-1353 (@media 1024px) | 删除 `.app-shell` 的 `padding-bottom`；`.content` padding-bottom 精确匹配；添加 `width: 100%` |
| `style.css` | ~L1620-1621 (@media 480px) | `.content` padding-bottom 同步更新 |
| `index.html` | L8 | CSS 版本号 v2 → v3 |

## 部署

确保修改后运行 `npx vercel --yes --prod` 部署到 Vercel。

## 验证

1. 手机浏览器访问 `https://shixun-lost-found.vercel.app`
2. 确认内容占满屏幕宽度，无两侧空白
3. 确认底部 5 个 Tab 全部可见
4. 确认内容可以滚动到底部，不会被导航栏遮挡
5. 如果仍有缓存问题，在浏览器中手动清除缓存或使用隐私模式
