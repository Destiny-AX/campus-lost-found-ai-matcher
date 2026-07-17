"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const evaluationDir = path.join(root, "docs", "evaluation");
const dataset = JSON.parse(fs.readFileSync(path.join(evaluationDir, "dataset.json"), "utf8"));
const notificationThreshold = Number(dataset.notification_threshold || 75);
const resultFloor = 40;

function loadMatcher() {
  const source = fs.readFileSync(path.join(root, "script.js"), "utf8");
  const sandbox = {
    console,
    document: { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    location: { search: "" },
    TextDecoder, TextEncoder, URL, URLSearchParams, AbortController, FormData, Blob, fetch,
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
    setTimeout, clearTimeout, setInterval, clearInterval,
  };
  vm.createContext(sandbox);
  vm.runInContext(source + "\n;globalThis.__evaluateMatch = calculateMatch;", sandbox, { filename: "script.js" });
  return sandbox.__evaluateMatch;
}

function normalizeWeights(weights) {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, total ? value / total : 0]));
}

const configurations = {
  A_metadata: {
    label: "A. 基础元数据匹配",
    description: "仅类别、颜色、地点、时间。",
    weights: normalizeWeights({ category: 0.13, color: 0.08, location: 0.14, time: 0.11, text: 0, image: 0, semantic: 0 }),
  },
  B_text_semantic: {
    label: "B. 文本／语义配置",
    description: "使用项目现有文本相似度和结构化语义能力。",
    weights: normalizeWeights({ category: 0, color: 0, location: 0, time: 0, text: 0.4, image: 0, semantic: 0.6 }),
  },
  C_seven_dimension: {
    label: "C. 当前七维融合",
    description: "类别、颜色、地点、时间、文本、图像和语义。",
    weights: { category: 0.13, color: 0.08, location: 0.14, time: 0.11, text: 0.14, image: 0.2, semantic: 0.2 },
  },
};

const ablations = {
  no_image: {
    label: "七维融合去掉图像维度",
    weights: normalizeWeights({ category: 0.13, color: 0.08, location: 0.14, time: 0.11, text: 0.14, image: 0, semantic: 0.2 }),
  },
  no_semantic: {
    label: "七维融合去掉语义维度",
    weights: normalizeWeights({ category: 0.13, color: 0.08, location: 0.14, time: 0.11, text: 0.14, image: 0.2, semantic: 0 }),
  },
  category_color_only: {
    label: "仅类别和颜色",
    weights: normalizeWeights({ category: 0.13, color: 0.08, location: 0, time: 0, text: 0, image: 0, semantic: 0 }),
  },
};

function imageFeatureForKey(key) {
  if (!key) return null;
  const digest = crypto.createHash("sha256").update(String(key)).digest();
  const bins = Array.from(digest.slice(0, 16), (value) => value + 1);
  const total = bins.reduce((sum, value) => sum + value, 0);
  return {
    histogram: bins.map((value) => value / total),
    hash: Array.from(digest.slice(16, 24), (value) => value.toString(2).padStart(8, "0")).join(""),
    dominantColor: [digest[24], digest[25], digest[26]],
  };
}

function hydrate(record) {
  return { ...record, imageFeature: imageFeatureForKey(record.image_key) };
}

function round(value, digits = 4) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function evaluateConfiguration(key, config, match) {
  const candidates = dataset.candidates.map(hydrate);
  const queries = dataset.queries.map(hydrate);
  const positiveQueries = queries.filter((query) => query.positive_ids.length > 0);
  let hit1 = 0;
  let hit3 = 0;
  let hit5 = 0;
  let reciprocalRankSum = 0;
  let notificationCount = 0;
  let falseNotificationCount = 0;
  let noResultCount = 0;
  const top1Coverage = [];
  const queryEvidence = [];

  for (const query of queries) {
    const ranked = candidates
      .map((candidate) => ({ candidate, result: match(query, candidate, config.weights) }))
      .sort((left, right) => right.result.score - left.result.score);
    const firstPositiveIndex = ranked.findIndex((entry) => query.positive_ids.includes(entry.candidate.id));
    if (query.positive_ids.length) {
      if (firstPositiveIndex === 0) hit1 += 1;
      if (firstPositiveIndex >= 0 && firstPositiveIndex < 3) hit3 += 1;
      if (firstPositiveIndex >= 0 && firstPositiveIndex < 5) hit5 += 1;
      if (firstPositiveIndex >= 0) reciprocalRankSum += 1 / (firstPositiveIndex + 1);
    }
    const top = ranked[0];
    if (!top || top.result.score < resultFloor) noResultCount += 1;
    if (top) top1Coverage.push(top.result.coverage);
    for (const entry of ranked) {
      if (entry.result.score < notificationThreshold) continue;
      notificationCount += 1;
      if (!query.positive_ids.includes(entry.candidate.id)) falseNotificationCount += 1;
    }
    queryEvidence.push({
      query_id: query.id,
      positive_ids: query.positive_ids,
      top5: ranked.slice(0, 5).map((entry) => ({
        candidate_id: entry.candidate.id,
        score: round(entry.result.score, 2),
        evidence_coverage: round(entry.result.coverage, 2),
        is_positive: query.positive_ids.includes(entry.candidate.id),
      })),
      first_positive_rank: firstPositiveIndex >= 0 ? firstPositiveIndex + 1 : null,
    });
  }

  const denominator = positiveQueries.length;
  return {
    key,
    label: config.label,
    description: config.description || "",
    weights: config.weights,
    query_count: queries.length,
    positive_query_count: denominator,
    no_match_query_count: queries.length - denominator,
    metrics: {
      hit_rate_at_1: denominator ? round(hit1 / denominator) : null,
      hit_rate_at_3: denominator ? round(hit3 / denominator) : null,
      hit_rate_at_5: denominator ? round(hit5 / denominator) : null,
      mrr: denominator ? round(reciprocalRankSum / denominator) : null,
      false_match_rate_at_notification_threshold: notificationCount ? round(falseNotificationCount / notificationCount) : null,
      notification_threshold: notificationThreshold,
      notification_count: notificationCount,
      false_notification_count: falseNotificationCount,
      no_result_rate_at_floor: round(noResultCount / queries.length),
      result_floor: resultFloor,
      result_coverage_at_floor: round(1 - noResultCount / queries.length),
      average_top1_evidence_coverage: round(top1Coverage.reduce((sum, value) => sum + value, 0) / top1Coverage.length),
    },
    query_evidence: queryEvidence,
  };
}

function main() {
  const match = loadMatcher();
  const configResults = Object.entries(configurations).map(([key, config]) => evaluateConfiguration(key, config, match));
  const ablationResults = Object.entries(ablations).map(([key, config]) => evaluateConfiguration(key, config, match));
  const output = {
    generated_at: new Date().toISOString(),
    dataset_name: dataset.dataset_name,
    dataset_version: dataset.version,
    dataset_provenance: dataset.provenance,
    sample_size_note: "28 条人工设计查询的小规模离线评测，仅用于产品决策与面试证据，不代表线上真实用户表现。",
    metric_definitions: {
      hit_rate_at_k: "仅在 positive_ids 非空的查询上，前 K 是否包含至少一个人工标注正例。",
      mrr: "仅在 positive_ids 非空的查询上，第一个正例排名倒数的平均值。",
      false_match_rate_at_notification_threshold: "所有分数达到 75 的候选通知中，非人工标注正例的占比；属于离线误通知代理指标。",
      no_result_rate_at_floor: "最高候选分低于 40 的查询占比。",
      result_coverage_at_floor: "至少一条候选分达到 40 的查询占比。",
      average_top1_evidence_coverage: "每条查询 Top-1 候选可用匹配维度权重覆盖率的平均值。",
    },
    configurations: configResults,
    ablations: ablationResults,
  };
  fs.writeFileSync(path.join(evaluationDir, "evaluation-results.json"), JSON.stringify(output, null, 2) + "\n", "utf8");
  for (const result of configResults) {
    console.log("RESULT | " + result.label + " | " + JSON.stringify(result.metrics));
  }
  console.log("SUMMARY | queries=" + dataset.queries.length + " candidates=" + dataset.candidates.length + " configs=" + configResults.length + " ablations=" + ablationResults.length);
}

main();
