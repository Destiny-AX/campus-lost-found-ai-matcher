# 启发式结构化回归摘要

- 执行时间：2026-07-13T06:49:26.751Z
- 默认时区：Asia/Shanghai
- 原 12 条：12/12 通过；新增非模板：9/9 通过；合计：21/21，0 失败
- 说明：输出来自实际执行，无模型 Key；失败项不隐藏。

| 用例 | 结果 | 类型 | 标题 | 地点 | 原始时间 | 联系方式 |
|---|---|---|---|---|---|---|
| lost-electronics | 通过 | lost | 黑色 AirPods Pro 充电盒 | 中国传媒大学图书馆 | 昨晚 | 空 |
| found-campus-card | 通过 | found | 蓝色 校园卡 | 学校食堂 | 今天 | 空 |
| found-id-card | 通过 | found | 身份证 | 国贸地铁站 | 未识别 | 空 |
| no-contact | 通过 | lost | 黑色 雨伞 | 朝阳公园 | 昨天下午 | 空 |
| mobile-contact | 通过 | found | 手机 | 双井 | 今天 | 13812345678 |
| wechat-contact | 通过 | found | 学习用品 | 图书馆 | 未识别 | 微信：lost_book88 |
| email-contact | 通过 | lost | 灰色 笔记本电脑 | 望京SOHO | 未识别 | test.user@example.com |
| relative-time | 通过 | lost | 白色 手机 | 三里屯 | 昨天下午3点 | 空 |
| explicit-date | 通过 | found | 黑色 箱包 | 北京站 | 2026年7月10日晚上8点 | 空 |
| fuzzy-location | 通过 | lost | 钥匙 | 图书馆三层或食堂 | 未识别 | 空 |
| mixed-fields | 通过 | lost | 黑色 AirPods Pro 充电盒 | 中国传媒大学图书馆 | 昨晚 | 空 |
| unreliable-input | 通过 | lost | 待确认物品 | 未识别 | 未识别 | 空 |
| non-template-sony-lost | 通过 | lost | 黑色 索尼耳机 | 中国传媒大学东门附近 | 昨晚 | 空 |
| non-template-leading-backpack | 通过 | found | 黑色 箱包 | 国贸站A口附近 | 未识别 | 空 |
| non-template-compact-umbrella | 通过 | found | 黑色 雨伞 | 一食堂 | 6月3号下午 | 空 |
| non-template-approx-clock | 通过 | lost | 白色 充电宝 | 传媒大学站 | 今天早上八点左右 | 空 |
| non-template-wechat-space | 通过 | lost | 待确认物品 | 未识别 | 未识别 | 微信：lostsony88 |
| non-template-last-week | 通过 | lost | 耳机 | 三食堂 | 大概上周五 | 空 |
| non-template-compact-blue-cup | 通过 | found | 蓝色 水杯 | 教学楼 | 未识别 | 空 |
| non-template-leading-location | 通过 | found | 黑色 雨伞 | 望京SOHO北门 | 未识别 | 空 |
| non-template-wechat-negative | 通过 | lost | 雨伞 | 未识别 | 未识别 | 空 |

详细字段状态、特征与串位检查见 `heuristic-regression-results.json`。
