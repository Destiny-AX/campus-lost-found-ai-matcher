# AI 产品经理面试证据索引

本目录用于把“代码里有什么”转换为“面试时能验证什么”。所有结果均区分真实调用、离线标注、确定性契约测试和待验证方案。

## P0 证据

1. 模型可观测性
   - `../model-observability/aborterror-root-cause.md`
   - `../model-observability/stability-report.md`
   - `../model-observability/stability-sample.json`
2. 离线 Evaluation
   - `../evaluation/dataset.json`（28 条人工标注的合成查询）
   - `../evaluation/label-guide.md`
   - `../evaluation/evaluation-results.json`
   - `../evaluation/evaluation-report.md`
   - `../evaluation/ablation-report.md`
3. 认领闭环
   - `../claim-evidence/claim-flow-report.md`
   - `../claim-evidence/claim-flow-evidence.json`
   - `../claim-evidence/screenshots/`
   - `../claim-evidence/90-second-demo-script.md`
   - `../claim-evidence/fallback-demo-plan.md`

## 数据与商业化

- `../interview-data/real-photo-plan.md`
- `../interview-data/import-template.json`
- `../business/b2b2c-hypothesis.md`

## 阅读边界

- 28 条 Evaluation 是离线小规模标注集，不代表线上真实用户表现。
- 图像维度使用确定性特征夹具验证融合逻辑，不代表视觉模型准确率。
- 认领闭环使用真实 API 模块和隔离内存 PostgREST 契约，不等同于 Preview Supabase 实测。
- 本轮真实 provider 稳定性指标因缺少隔离 Preview 凭证未计算，不能把 Mock 延迟包装为 P50/P95。
- 商业化内容是待访谈假设，不是收入或客户成果。
