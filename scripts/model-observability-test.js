"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  runModelCascade,
} = require("../api/structured-input");

const results = [];
const originalText = "昨晚在校图书馆丢了黑色耳机";
const validModelPayload = {
  type: "lost",
  title: "无线耳机",
  category: "电子设备",
  color: "黑色",
  location: "校图书馆",
  time: "",
  contact: "",
  features: ["充电盒有划痕"],
};

function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      results.push({ name, status: "PASS" });
      console.log(`PASS | ${name}`);
    });
}

function providerResponse(status, modelPayload = validModelPayload) {
  const body = status >= 200 && status < 300
    ? { choices: [{ message: { content: JSON.stringify(modelPayload) } }] }
    : { code: status, message: "redacted provider error" };
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(body); },
  };
}

function abortError() {
  const error = new Error("aborted");
  error.name = "AbortError";
  return error;
}

async function runWith(fetchImpl, options = {}) {
  return runModelCascade({
    apiKey: "test-key-never-sent",
    prompt: "test prompt without private data",
    originalText,
    requestId: "test-request-id",
    startedAt: Date.now(),
    fetchImpl,
    totalBudgetMs: 5000,
    primaryTimeoutMs: 2000,
    fallbackTimeoutMs: 2000,
    models: ["primary-model", "fallback-model"],
    ...options,
  });
}

async function main() {
  await check("主模型成功时记录完整可观测字段", async () => {
    const result = await runWith(async () => providerResponse(200));
    assert.equal(result.source, "ai");
    assert.equal(result.model, "primary-model");
    assert.equal(result.attempts.length, 1);
    assert.equal(result.attempts[0].parse_status, "success");
    assert.equal(result.provider_status, 200);
    assert.equal(result.parse_status, "success");
    assert.equal(result.fallback_reason, null);
    assert.ok(result.request_id);
    assert.ok(Number.isFinite(result.latency_ms));
  });

  await check("主模型超时后只降级一次并由备用模型成功", async () => {
    let calls = 0;
    const result = await runWith(async () => {
      calls += 1;
      if (calls === 1) throw abortError();
      return providerResponse(200);
    });
    assert.equal(result.source, "ai");
    assert.equal(result.model, "fallback-model");
    assert.equal(result.attempts.length, 2);
    assert.equal(result.fallback_reason, "provider_timeout");
    assert.equal(result.attempts[0].provider_status, "timeout");
  });

  await check("429 属于可重试临时错误并触发模型降级", async () => {
    let calls = 0;
    const result = await runWith(async () => (++calls === 1 ? providerResponse(429) : providerResponse(200)));
    assert.equal(result.source, "ai");
    assert.equal(result.model, "fallback-model");
    assert.equal(result.fallback_reason, "provider_rate_limited");
  });

  await check("非重试 4xx 不继续消耗第二次模型调用", async () => {
    let calls = 0;
    const result = await runWith(async () => {
      calls += 1;
      return providerResponse(400);
    });
    assert.equal(result.source, "heuristic_fallback");
    assert.equal(result.fallback_reason, "provider_http_400");
    assert.equal(calls, 1);
    assert.equal(result.attempts.length, 1);
  });

  await check("主模型 JSON 解析失败后仅尝试备用模型一次", async () => {
    let calls = 0;
    const result = await runWith(async () => {
      calls += 1;
      if (calls === 1) return providerResponse(200, {});
      return providerResponse(200);
    });
    assert.equal(result.source, "ai");
    assert.equal(result.model, "fallback-model");
    assert.equal(result.fallback_reason, "parse_error");
    assert.equal(result.attempts[0].parse_status, "failed");
  });

  await check("两个模型均超时时规则兜底不计为模型成功", async () => {
    const result = await runWith(async () => { throw abortError(); });
    assert.equal(result.source, "heuristic_fallback");
    assert.equal(result.model, null);
    assert.equal(result.fallback_reason, "provider_timeout");
    assert.equal(result.attempts.length, 2);
    assert.ok(result.structured.title);
  });

  await check("可观测尝试记录不包含 API Key 或用户原文", async () => {
    const result = await runWith(async () => providerResponse(200));
    const serialized = JSON.stringify(result.attempts);
    assert.ok(!serialized.includes("test-key-never-sent"));
    assert.ok(!serialized.includes(originalText));
  });

  await check("前端详细信息仅由 interview/debug 参数开启且默认折叠", async () => {
    const root = path.resolve(__dirname, "..");
    const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
    const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
    assert.ok(html.includes('id="aiProcessingPanel" hidden'));
    assert.ok(!html.includes('id="aiProcessingPanel" open'));
    assert.ok(script.includes('params.get("interview")'));
    assert.ok(script.includes('params.get("debug")'));
    assert.ok(script.includes("renderAiProcessingInfo(payload)"));
  });

  console.log(`SUMMARY | passed=${results.length} failed=0 total=${results.length}`);
}

main().catch((error) => {
  console.error(`FAIL | ${error.stack || error.message}`);
  process.exitCode = 1;
});
