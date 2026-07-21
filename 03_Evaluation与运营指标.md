# 03｜Evaluation 与运营指标

本文件定义“上线前怎么证明有用、上线后怎么持续优化”。当前项目没有真实标注集和线上流量，因此只给方案、口径和验收门槛建议，不填写虚构结果。

## 一、评测目标

```text
发布可用性 → 抽取质量 → 候选召回 → 通知打扰 → 人工确认 → 认领完成 → 双边归还
```

不能只看“匹配分高不高”。匹配系统至少同时优化：找得到、排得前、理由可信、不误打扰、能完成认领。

## 二、离线数据集

### 样本单元

- 发布抽取集：`raw_text / image / gold_fields / annotator_notes`
- 匹配对集：`query_record / candidate_record / label / hard_negative_type`
- 候选列表集：一个 query 对应全部候选及唯一或多个正例

### 标签

- `exact_match`：同一物品，强正例。
- `possible_match`：信息不足，需人工核验。
- `not_match`：明确不同物品。
- `hard_negative`：同品类、同颜色、同地点或相近时间但不同物品。

### 切分原则

- 按事件而不是按记录随机切分，避免同一物品泄漏到训练/测试两侧。
- 城市、品类、有图/无图、字段缺失程度分层。
- 单独保留证件、贵重物品、公开机构等高风险切片。
- 双人标注 + 冲突仲裁；记录 Cohen’s Kappa 或一致率。

## 三、自然语言结构化指标

| 指标 | 口径 | 用途 |
|---|---|---|
| 类型 / 类别准确率 | 字段完全一致样本数 ÷ 有标签样本数 | 核心离散字段 |
| 颜色 Macro-F1 | 各颜色 F1 宏平均 | 防止高频颜色掩盖长尾 |
| 地点层级准确率 | district / street / detail 分层统计 | 区分“可筛选”与“精确定位” |
| 时间归一化误差 | 预测时间与标注时间绝对差 | 相对时间解析 |
| 必填字段完成率 | 必填字段全部可用的样本占比 | 能否直接提交 |
| 人工修正率 | AI 填表后被用户改动的字段数 ÷ AI 填充字段数 | 产品可用性 |
| 降级率 | heuristic / fallback 请求数 ÷ 抽取请求数 | 模型可用性 |
| P95 延迟 / 单次成本 | 服务端日志聚合 | 商业化成本控制 |

建议分层看“模型成功”“模型降级”“纯手填”，避免把规则兜底效果算作模型效果。

## 四、图片识别指标

- 物品类别 Top-1 Accuracy。
- 属性 F1：颜色、品牌、材质、形状、划痕 / 挂件等。
- 可见文字 Character Error Rate（只在有文字样本上）。
- 置信度校准：ECE / reliability curve。
- 无法识别率与错误高置信率。
- 有图但视觉 API 失败率、超时率、P95 延迟、图片平均 token / 成本。

验收时必须加入模糊、遮挡、多物体、极端光照、隐私敏感图片等失败集。

## 五、匹配核心指标

### Top-K 命中率

```text
HitRate@K = 至少一个真实正例出现在前 K 的 query 数 / 有正例的 query 数
```

重点观察 `K=1/3/5`。Top-5 适合失物场景的“候选交给人确认”逻辑。

### MRR / nDCG

- MRR：第一个正例排名的倒数，衡量“正例是否靠前”。
- nDCG@K：支持 exact / possible 多级相关性。

### 误匹配率

```text
FalseMatchRate@T = 分数 ≥ T 的负例数 / 分数 ≥ T 的全部样本数
```

通知阈值应重点控制误匹配率；高风险品类单独设更严门槛。

### 人工确认率

```text
ManualConfirmRate = 被用户确认“有帮助 / 是同一物品”的候选点击数 / 被查看候选数
```

它是线上代理指标，不等于最终找回率。

### 覆盖与缺失切片

至少分组：

- 有图 vs 无图；
- 7 维完整 vs 缺失 1～2 维 vs 缺失 3 维以上；
- 同地点高频品类 vs 长尾品类；
- AI 语义 vs 启发式语义；
- 高风险物品 vs 一般物品。

## 六、基线与消融

1. Baseline A：只按类别 + 地点 + 时间。
2. Baseline B：A + 文本。
3. Variant C：B + 本地图像特征。
4. Variant D：C + AI 语义。
5. Variant E：D + 缺失感知 / 覆盖惩罚。

比较 HitRate@5、MRR、FalseMatchRate@通知阈值、平均延迟和单次成本。若 AI 语义没有显著提升或成本过高，应降为仅在高价值类别 / 低置信样本触发。

## 七、线上运营漏斗

### 发布漏斗

| 指标 | 公式 |
|---|---|
| 发布页到达率 | `publish_view / active_user` |
| AI 填表使用率 | `ai_extract_click / publish_view` |
| 图片上传率 | `image_upload_success / publish_start` |
| 发布完成率 | `publish_success / publish_start` |
| 字段修正率 | `edited_ai_fields / populated_ai_fields` |
| 发布耗时 | `publish_success_ts - publish_start_ts` |

### 匹配与通知

| 指标 | 公式 |
|---|---|
| 有候选率 | `queries_with_candidate / match_query` |
| Top-K 点击率 | `candidate_detail_view / candidate_impression` |
| 通知触达率 | `notify_delivered / notify_created` |
| 通知打开率 | `notify_open / notify_delivered` |
| 通知后认领率 | `claim_submit_after_notify / notify_open` |
| 退订 / 屏蔽率 | `notification_opt_out / notified_user` |

当前实现是站内轮询，严格说只能统计“创建、拉取、已读”，不能宣称系统 Push 触达。

### 认领与归还

| 指标 | 公式 |
|---|---|
| 认领发起率 | `claim_submit / found_detail_view` |
| 认领审核率 | `claim_reviewed / claim_submit` |
| 审核通过率 | `claim_approved / claim_reviewed` |
| 联系解锁率 | `contact_unlocked / claim_approved` |
| 双边确认率 | `owner_confirmed_and_finder_confirmed / claim_approved` |
| 认领完成率 | `resolved / claim_submit` |
| 平均闭环时长 | `resolved_ts - publish_ts` |

### 安全与质量护栏

- 举报率、重复认领率、恶意申请率。
- 联系方式异常访问率。
- 高分误匹配投诉率。
- 未实名尝试解锁次数。
- API 失败率、超时率、降级率。
- 单次成功认领的模型成本。

## 八、事件建议

核心事件：

```text
publish_view / ai_extract_request / ai_extract_result / ai_field_edit
image_upload_result / match_impression / candidate_click / reason_expand
notify_created / notify_polled / notify_read
verify_mock_complete / claim_submit / claim_review / contact_unlock
finder_confirm_return / owner_confirm_receive / recovery_complete / report_submit
```

公共属性：`user_id_hash`、`record_id`、`city`、`category`、`has_image`、`semantic_source`、`missing_dimensions`、`coverage_bucket`、`model`、`latency_ms`、`fallback_reason`、`experiment_id`。

禁止上传真实姓名、身份证、完整联系方式、原始图片 Base64 等敏感字段到分析平台。

## 九、看板建议

- WBR：发布完成率、AI 使用率、降级率、HitRate 代理、通知打开率、认领完成率、投诉率、AI 成本。
- 模型日看板：成功率、P95 延迟、JSON 解析失败、字段修正、图片不可识别、高置信错误。
- 分群：城市 / 品类 / 新老用户 / 有无图片 / 模型版本 / 证据覆盖。

所有指标上线前先定义 owner、数据源、去重、窗口和延迟，不在没有数据时填写结果。