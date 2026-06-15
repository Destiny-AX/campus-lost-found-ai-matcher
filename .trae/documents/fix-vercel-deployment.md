# 修复 Vercel 部署计划

## 问题摘要

整个网站访问返回 404: NOT_FOUND。根本原因是 `vercel.json` 配置错误，导致 Vercel 没有正确构建和部署静态文件。

## 当前状态分析

### 问题 1: `vercel.json` 缺少 `builds` 字段
- 当前 `vercel.json` 只有 `routes` 字段，没有 `builds` 字段
- Vercel 构建日志显示只构建了 API 函数（`api/*`），没有构建 `index.html`、`style.css`、`script.js`
- 这导致访问首页时返回 404

### 问题 2: 图片静态资源访问
- 8 张真实物品图片已放入 `public/images/` 和 `images/` 两个目录
- 之前的配置中，`routes` 的 `/(.*)` 通配符会拦截 `/images/xxx` 请求，将其重定向到 `index.html`
- 需要确保 `/images/*` 路由在 `/(.*)` 之前匹配，或使用 `headers` 配置

### 问题 3: 配置演进历史
- 之前正常工作的配置（commit `a2e9c76`）同时包含 `builds` 和 `routes`
- 后续修改为简化配置时，误删了 `builds` 字段
- 然后又错误地修改了 `routes`，导致问题加剧

## 修复方案

### 步骤 1: 恢复正确的 `vercel.json` 配置

恢复之前正常工作的配置结构，同时确保图片可以访问：

```json
{
  "version": 2,
  "builds": [
    { "src": "index.html", "use": "@vercel/static" },
    { "src": "style.css", "use": "@vercel/static" },
    { "src": "script.js", "use": "@vercel/static" },
    { "src": "api/analyze-image.js", "use": "@vercel/node" },
    { "src": "api/records.js", "use": "@vercel/node" },
    { "src": "api/auth.js", "use": "@vercel/node" },
    { "src": "api/structured-input.js", "use": "@vercel/node" },
    { "src": "api/notify.js", "use": "@vercel/node" },
    { "src": "api/custody.js", "use": "@vercel/node" },
    { "src": "api/upload-image.js", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/api/analyze-image", "dest": "/api/analyze-image.js" },
    { "src": "/api/records", "dest": "/api/records.js" },
    { "src": "/api/auth", "dest": "/api/auth.js" },
    { "src": "/api/structured-input", "dest": "/api/structured-input.js" },
    { "src": "/api/notify", "dest": "/api/notify.js" },
    { "src": "/api/custody", "dest": "/api/custody.js" },
    { "src": "/api/upload-image", "dest": "/api/upload-image.js" },
    { "src": "/images/(.*)", "dest": "/images/$1" },
    { "src": "/style.css", "dest": "/style.css" },
    { "src": "/script.js", "dest": "/script.js" },
    { "src": "/", "dest": "/index.html" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

**关键修复点**：
- 恢复 `builds` 字段，显式声明所有静态文件和 API 函数
- `/images/(.*)` 路由放在 `/(.*)` 之前，确保图片请求优先匹配
- `public/images/` 目录下的文件会被 Vercel 自动部署为静态资源

### 步骤 2: 验证文件结构

确保以下文件和目录存在：
- `d:\Trae_Solo_Project\拾寻\index.html` ✓
- `d:\Trae_Solo_Project\拾寻\style.css` ✓
- `d:\Trae_Solo_Project\拾寻\script.js` ✓
- `d:\Trae_Solo_Project\拾寻\public\images\`（8张图片）✓
- `d:\Trae_Solo_Project\拾寻\api\*.js`（7个API文件）✓

### 步骤 3: 代码自检

- 检查 `api/records.js` 语法
- 检查所有 API 文件语法

### 步骤 4: 提交并部署

- 提交 `vercel.json` 修改
- 执行 `npx vercel deploy --prod --yes --force`
- 验证部署结果

### 步骤 5: 验证修复

- 访问首页 `https://shixun-lost-found.vercel.app`，确认不再 404
- 访问图片 `https://shixun-lost-found.vercel.app/images/耳机.png`，确认图片可访问
- 选择"中国传媒大学"筛选，确认示例数据展示真实图片

## 假设与决策

1. **假设**: `public/images/` 目录会被 Vercel 自动部署为静态资源
   - 验证: 部署后通过 URL 直接访问图片
   - 如果失败: 需要将图片移到项目根目录的 `images/` 并在 `builds` 中显式配置

2. **假设**: 恢复之前的 `builds` + `routes` 配置可以修复 404 问题
   - 验证: 部署后首页正常加载
   - 这是基于 git 历史中的工作配置

3. **决策**: 不修改 `api/records.js` 中的图片路径
   - 当前路径 `/images/xxx.png` 是正确的相对路径
   - 只要 Vercel 能正确部署 `public/images/`，图片就能加载

## 回滚方案

如果修复失败，可以回滚到之前正常工作的提交：
```bash
git checkout a2e9c76 -- vercel.json
```

但需要注意这会丢失图片路径的更新。