"use strict";

const fs = require("fs");
const path = require("path");
process.env.LOST_FOUND_TIME_ZONE = "Asia/Shanghai";
const { heuristicExtract } = require("../api/structured-input");

const cases = [
  { id: "lost-electronics", input: "昨晚在中国传媒大学图书馆丢了一个黑色 AirPods Pro，充电盒有一道划痕。", expect: (o) => o.type === "lost" && o.item_name === "AirPods Pro 充电盒" && o.title === "黑色 AirPods Pro 充电盒" && o.location === "中国传媒大学图书馆" && o.contact === "" && o.features.some((x) => x.includes("划痕")) && o.field_status.time === "待确认" },
  { id: "found-campus-card", input: "今天在学校食堂捡到一张蓝色校园卡。", expect: (o) => o.type === "found" && o.item_name === "校园卡" && o.title === "蓝色 校园卡" && o.location === "学校食堂" },
  { id: "found-id-card", input: "在国贸地铁站捡到身份证，已经交给服务台。", expect: (o) => o.type === "found" && o.item_name === "身份证" && o.location === "国贸地铁站" && o.contact === "" && o.item_status === "institution" },
  { id: "no-contact", input: "昨天下午在朝阳公园丢了黑色雨伞，没有留下联系方式。", expect: (o) => o.contact === "" && o.field_status.contact === "未识别" },
  { id: "mobile-contact", input: "今天在双井捡到钥匙，手机号：13812345678。", expect: (o) => o.contact === "13812345678" && o.contact_type === "phone" },
  { id: "wechat-contact", input: "在图书馆捡到一本教材，微信号：lost_book88。", expect: (o) => o.contact === "微信：lost_book88" && o.contact_type === "wechat" },
  { id: "email-contact", input: "地点是望京SOHO，丢失灰色笔记本电脑，邮箱：test.user@example.com。", expect: (o) => o.contact === "test.user@example.com" && o.contact_type === "email" },
  { id: "relative-time", input: "昨天下午3点在三里屯丢了一个白色手机。", expect: (o) => o.time.endsWith("T15:00") && o.time_precision === "exact" && o.field_status.time === "高置信" },
  { id: "explicit-date", input: "2026年7月10日晚上8点在北京站捡到黑色双肩包。", expect: (o) => o.time === "2026-07-10T20:00" && o.raw_time_expression.includes("2026年7月10日") },
  { id: "fuzzy-location", input: "钥匙可能落在图书馆三层或食堂，具体位置不确定。", expect: (o) => o.location === "图书馆三层或食堂" && o.field_status.location === "待确认" },
  { id: "mixed-fields", input: "昨晚在中国传媒大学图书馆丢了一个黑色 AirPods Pro，充电盒有一道划痕。", expect: (o) => !/黑色|AirPods|划痕/.test(o.location) && !/图书馆/.test(o.title) && o.contact === "" },
  { id: "unreliable-input", input: "这是一段完全无法可靠识别的信息。", expect: (o) => o.item_name === "" && o.title === "待确认物品" && o.location === "" && o.time === "" && o.contact === "" && o.field_status.item === "未识别" && o.requires_confirmation },
  { id: "non-template-sony-lost", group: "non_template", input: "我昨晚可能在中国传媒大学东门附近把黑色索尼耳机落下了", expect: (o) => o.type === "lost" && o.item_name === "索尼耳机" && o.color === "黑色" && o.location === "中国传媒大学东门附近" && !/黑色|索尼|耳机|落下/.test(o.location) && o.field_status.location === "待确认" },
  { id: "non-template-leading-backpack", group: "non_template", input: "国贸站A口附近捡到黑色双肩包，里面有两本书", expect: (o) => o.type === "found" && o.location === "国贸站A口附近" && o.color === "黑色" && o.features.some((x) => x.includes("两本书")) },
  { id: "non-template-compact-umbrella", group: "non_template", input: "6月3号下午在一食堂捡到一把黑伞", expect: (o) => o.type === "found" && o.item_name === "雨伞" && o.color === "黑色" && o.location === "一食堂" && o.raw_time_expression.includes("6月3号") && o.field_status.time === "待确认" },
  { id: "non-template-approx-clock", group: "non_template", input: "今天早上八点左右在传媒大学站丢了白色充电宝", expect: (o) => o.type === "lost" && o.item_name === "充电宝" && o.color === "白色" && o.location === "传媒大学站" && o.raw_time_expression.includes("左右") && o.time === "" && o.time_precision === "approximate" && o.field_status.time === "待确认" },
  { id: "non-template-wechat-space", group: "non_template", input: "微信 lostsony88", expect: (o) => o.contact === "微信：lostsony88" && o.contact_type === "wechat" && o.field_status.contact === "待确认" },
  { id: "non-template-last-week", group: "non_template", input: "大概上周五在三食堂落下耳机", expect: (o) => o.type === "lost" && o.item_name === "耳机" && o.location === "三食堂" && o.raw_time_expression.includes("上周五") && o.normalized_date === "" && o.field_status.time === "待确认" },
  { id: "non-template-compact-blue-cup", group: "non_template", input: "地点是教学楼，捡到蓝杯子", expect: (o) => o.type === "found" && o.item_name === "水杯" && o.color === "蓝色" && o.location === "教学楼" },
  { id: "non-template-leading-location", group: "non_template", input: "望京SOHO北门捡到黑伞", expect: (o) => o.type === "found" && o.location === "望京SOHO北门" && o.item_name === "雨伞" && o.color === "黑色" },
  { id: "non-template-wechat-negative", group: "non_template", input: "我在微信聊天里看到有人提到一把伞", expect: (o) => o.contact === "" && o.field_status.contact === "未识别" },
];

const results = cases.map((testCase) => {
  const output = heuristicExtract(testCase.input);
  let passed = false;
  let error = "";
  try { passed = Boolean(testCase.expect(output)); } catch (exception) { error = exception.message; }
  const crossFieldIssues = [];
  if (output.location && /手机号|电话|微信|邮箱|QQ/.test(output.location)) crossFieldIssues.push("location_contains_contact");
  if (output.contact && output.contact.length > 120) crossFieldIssues.push("contact_too_long");
  if (output.title && output.location && output.title.includes(output.location)) crossFieldIssues.push("title_contains_location");
  if (crossFieldIssues.length) passed = false;
  return { id: testCase.id, group: testCase.group || "original", input: testCase.input, passed, error, cross_field_issues: crossFieldIssues, output };
});

const summarizeGroup = (group) => {
  const scoped = results.filter((result) => result.group === group);
  return {
    total: scoped.length,
    passed: scoped.filter((result) => result.passed).length,
    failed: scoped.filter((result) => !result.passed).length,
  };
};
const summary = {
  generated_at: new Date().toISOString(),
  timezone: "Asia/Shanghai",
  total: results.length,
  passed: results.filter((result) => result.passed).length,
  failed: results.filter((result) => !result.passed).length,
  original: summarizeGroup("original"),
  non_template: summarizeGroup("non_template"),
  results,
};
for (const result of results) {
  console.log(`${result.passed ? "PASS" : "FAIL"} | ${result.id} | title=${result.output.title || "<empty>"} | location=${result.output.location || "<empty>"} | time=${result.output.time || result.output.raw_time_expression || "<empty>"} | contact=${result.output.contact || "<empty>"}`);
}
console.log(`SUMMARY | passed=${summary.passed} failed=${summary.failed} total=${summary.total}`);

if (process.argv.includes("--write")) {
  const outputDir = path.resolve(__dirname, "../docs/verification");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "heuristic-regression-results.json"), JSON.stringify(summary, null, 2), "utf8");
  const rows = results.map((result) => `| ${result.id} | ${result.passed ? "通过" : "失败"} | ${result.output.type} | ${result.output.title || "未识别"} | ${result.output.location || "未识别"} | ${result.output.raw_time_expression || "未识别"} | ${result.output.contact || "空"} |`).join("\n");
  const markdown = `# 启发式结构化回归摘要\n\n- 执行时间：${summary.generated_at}\n- 默认时区：Asia/Shanghai\n- 原 12 条：${summary.original.passed}/${summary.original.total} 通过；新增非模板：${summary.non_template.passed}/${summary.non_template.total} 通过；合计：${summary.passed}/${summary.total}，${summary.failed} 失败\n- 说明：输出来自实际执行，无模型 Key；失败项不隐藏。\n\n| 用例 | 结果 | 类型 | 标题 | 地点 | 原始时间 | 联系方式 |\n|---|---|---|---|---|---|---|\n${rows}\n\n详细字段状态、特征与串位检查见 \`heuristic-regression-results.json\`。\n`;
  fs.writeFileSync(path.join(outputDir, "heuristic-regression-summary.md"), markdown, "utf8");
}
if (summary.failed) process.exitCode = 1;
