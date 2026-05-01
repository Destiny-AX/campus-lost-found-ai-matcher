# 校园失物招领 AI 智能匹配程序

## 项目简介

本项目面向校园失物招领信息分散、人工查找效率低的问题，构建一个可在电脑和手机端访问的响应式 H5 程序。用户可以发布失物或招领信息，系统会根据文本、地点、时间、上传图片的视觉特征和视觉模型识别出的语义标签进行混合匹配，并给出匹配分数与可解释理由。

## 核心功能

- 失物广场：浏览失物和招领信息，支持搜索和筛选。
- 发布信息：填写物品类别、颜色、地点、时间、描述和联系方式。
- 拖拽上传：发布界面支持点击选择图片，也支持直接拖入图片。
- 图片特征提取：浏览器端提取主色、颜色直方图和感知哈希。
- 视觉语义识别：服务端调用 SiliconFlow 图像理解模型识别物品名称、类别、颜色、品牌、可见文字和外观特征。
- 数据持久化：通过 Supabase 保存发布记录，线上访问、刷新、换设备后数据仍可保留。
- AI 智能匹配：融合文本相似度、地点关联度、时间接近度、图像相似度和语义相似度计算总分。
- 可解释结果：展示每个候选匹配项的总分、分项得分和匹配理由。
- 响应式界面：电脑端适合课堂投屏，手机端接近小程序浏览体验。

## 混合匹配算法

```text
总匹配度 =
类别相似度 13%
+ 颜色相似度 8%
+ 地点相似度 14%
+ 时间接近度 11%
+ 文本描述相似度 14%
+ 图像相似度 20%
+ 语义相似度 20%
```

图像相似度由三部分组成：

- 颜色直方图：比较两张图片整体颜色分布。
- 感知哈希：比较图片低层视觉结构。
- 主色距离：比较图片主色调是否接近。

语义相似度会比较模型识别出的物品名称、类别、颜色、品牌、可见文字和外观特征。当前版本已经包含一定程度的语义级图像识别，同时保留本地低层视觉特征匹配，作为网络或模型不可用时的降级能力。

## 技术栈

- HTML
- CSS
- JavaScript
- Canvas 图像处理
- Vercel Serverless Functions
- Supabase
- SiliconFlow OpenAI 兼容接口

## 本地运行

```bash
npm start
```

启动后访问：

```text
http://localhost:4173
```

本地服务由 `local-server.js` 提供。若未配置 Supabase，页面仍会显示内置示例数据，新发布记录只在当前浏览器运行时临时存在。

## Supabase 建表

在 Supabase SQL Editor 中执行：

```sql
create table if not exists public.lost_found_records (
  id text primary key,
  type text not null check (type in ('lost', 'found')),
  title text not null,
  category text not null,
  color text not null,
  location text not null,
  event_time text not null,
  contact text,
  description text,
  status text not null,
  image_data text,
  image_feature jsonb,
  semantic jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lost_found_records_created_at_idx
  on public.lost_found_records (created_at desc);

create index if not exists lost_found_records_type_idx
  on public.lost_found_records (type);
```

同样的 SQL 已放在 `supabase-schema.sql`。

## Vercel 部署

本项目包含两个 Vercel Serverless Functions：

```text
api/analyze-image.js
api/records.js
```

需要在 Vercel 项目环境变量中配置：

```text
silicon_flow_api_key=<你的 SiliconFlow API Key>
SUPABASE_URL=<你的 Supabase Project URL>
SUPABASE_SERVICE_ROLE_KEY=<你的 Supabase service_role key>
```

前端通过 `/api/analyze-image` 调用图像语义识别，通过 `/api/records` 读写失物招领记录。API Key 和 Supabase service role key 都只保存在服务端环境变量中，不会暴露到浏览器。

## 后续扩展方向

- 微信小程序版本：使用 uni-app 或 Taro 迁移界面与交互逻辑。
- Supabase Storage：把图片文件从 base64 文本迁移到对象存储。
- OCR：识别校园卡、学生证上的部分文字信息。
- 消息提醒：高匹配线索出现后推送给用户。
