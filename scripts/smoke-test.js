"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const net = require("net");

const OFFLINE_ENV_NAMES = [
  "LOST_FOUND_SUPABASE_URL", "SUPABASE_URL", "supabase_url",
  "LOST_FOUND_SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "supabase_service_role_key",
  "SUPABASE_KEY", "supabase_key", "SUPABASE_ANON_KEY", "supabase_anon_key",
  "LOST_FOUND_SILICON_FLOW_API_KEY", "silicon_flow_api_key", "SILICON_FLOW_API_KEY", "SILICONFLOW_API_KEY",
];
for (const name of OFFLINE_ENV_NAMES) process.env[name] = " ";
process.env.LOST_FOUND_JWT_SECRET = "smoke-test-only-not-for-production";
process.env.LOST_FOUND_TIME_ZONE = "Asia/Shanghai";

const { startServer } = require("../local-server");
const root = path.resolve(__dirname, "..");
const results = [];
let server;
let baseUrl;
let port;

function check(name, condition, detail = "") {
  const passed = Boolean(condition);
  results.push({ name, status: passed ? "PASS" : "FAIL", detail });
  console.log(`${passed ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
  if (!passed) throw new Error(`${name}: ${detail || "condition was false"}`);
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch (error) { body = { raw: text }; }
  return { response, body };
}

function loadPageMatcher() {
  const source = fs.readFileSync(path.join(root, "script.js"), "utf8");
  const sandbox = {
    console,
    document: { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    TextDecoder, TextEncoder, URL, AbortController, FormData, Blob, fetch,
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
    setTimeout, clearTimeout, setInterval, clearInterval,
  };
  vm.createContext(sandbox);
  vm.runInContext(`${source}\n;globalThis.__smokeCalculateMatch = calculateMatch;`, sandbox, { filename: "script.js" });
  return sandbox.__smokeCalculateMatch;
}

function isPortClosed(targetPort) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port: targetPort });
    socket.setTimeout(800);
    socket.once("connect", () => { socket.destroy(); resolve(false); });
    socket.once("error", () => resolve(true));
    socket.once("timeout", () => { socket.destroy(); resolve(true); });
  });
}

async function main() {
  try {
    server = await startServer(0);
    port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    check("使用独立可控端口启动服务", port > 0 && port !== 4173, `port=${port}`);

    const home = await fetch(`${baseUrl}/`);
    check("GET / 返回 200", home.status === 200, `status=${home.status}`);
    check("首页已移除作品集演示提示", !(await home.text()).includes("作品集演示版"));
    const css = await fetch(`${baseUrl}/style.css`);
    const js = await fetch(`${baseUrl}/script.js`);
    const logo = await fetch(`${baseUrl}/images/logo.png`);
    const chineseImage = await fetch(`${baseUrl}/images/%E8%80%B3%E6%9C%BA.png`);
    check("静态资源与中文图片路径返回 200", css.status === 200 && js.status === 200 && logo.status === 200 && chineseImage.status === 200, `css=${css.status},js=${js.status},logo=${logo.status},chinese=${chineseImage.status}`);

    const visitorRecords = await jsonFetch(`${baseUrl}/api/records`);
    check("GET /api/records 返回 200", visitorRecords.response.status === 200, `status=${visitorRecords.response.status}`);
    check("数据源为 demo_memory", visitorRecords.body.source === "demo_memory", `source=${visitorRecords.body.source}`);
    const initial = visitorRecords.body.records || [];
    check("初始记录数为 40", initial.length === 40, `count=${initial.length}`);
    const lostCount = initial.filter((record) => record.type === "lost").length;
    const foundCount = initial.filter((record) => record.type === "found").length;
    check("寻物数量符合预期", lostCount === 20, `lost=${lostCount}`);
    check("招领数量符合预期", foundCount === 20, `found=${foundCount}`);
    const requiredFields = ["id", "type", "title", "category", "location", "time", "description", "is_fuzzy"];
    check("数据结构完整", initial.every((record) => requiredFields.every((field) => Object.hasOwn(record, field))), requiredFields.join(","));
    const visitorFound = initial.filter((record) => record.type === "found");
    check("游客联系方式已脱敏", visitorFound.every((record) => record.is_fuzzy && record.contact === "__FUZZY_CONTACT__"), `checked=${visitorFound.length}`);
    check("游客精确地点已处理", visitorFound.every((record) => record.is_fuzzy && /附近|范围内/.test(record.location) && !record.street && !record.detail_location), `checked=${visitorFound.length}`);

    const login = await jsonFetch(`${baseUrl}/api/auth?action=guest-login`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nickname: "Smoke测试用户" }),
    });
    check("测试用户能够登录", login.response.status === 200 && Boolean(login.body.token), `status=${login.response.status}`);
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${login.body.token}` };
    const recordId = `smoke-${Date.now()}`;
    const create = await jsonFetch(`${baseUrl}/api/records`, {
      method: "POST", headers: authHeaders, body: JSON.stringify({ record: {
        id: recordId, type: "lost", title: "银色测试钥匙", category: "钥匙", color: "银色",
        location: "朝阳区 中国传媒大学 图书馆", time: new Date().toISOString().slice(0, 16),
        contact: "仅用于本地Smoke测试", description: "带蓝色钥匙扣的测试记录", status: "待找回",
      } }),
    });
    check("离线发布成功", create.response.status === 200 && create.body.source === "demo_memory", `status=${create.response.status},source=${create.body.source}`);
    const afterCreate = await jsonFetch(`${baseUrl}/api/records`, { headers: { Authorization: `Bearer ${login.body.token}` } });
    const afterRecords = afterCreate.body.records || [];
    check("发布后记录数增加 1", afterRecords.length === 41, `count=${afterRecords.length}`);
    const newRecord = afterRecords.find((record) => record.id === recordId);
    check("新增记录可以查询", Boolean(newRecord), `id=${recordId}`);

    const candidate = afterRecords.find((record) => record.type === "found");
    const calculateMatch = loadPageMatcher();
    const match = calculateMatch(newRecord, candidate);
    check("新增记录可以参与匹配", Number.isFinite(match.score), `score=${match.score.toFixed(2)}`);
    const dimensions = ["category", "color", "location", "time", "text", "image", "semantic"];
    check("匹配结果包含解释维度", dimensions.every((key) => Object.hasOwn(match.breakdown, key)) && Array.isArray(match.reasons), `dimensions=${Object.keys(match.breakdown).join(",")}`);
    check("匹配结果包含缺失与覆盖信息", Array.isArray(match.missingDimensions) && Number.isFinite(match.coverage), `coverage=${match.coverage}`);

    const admin = await jsonFetch(`${baseUrl}/api/records?action=diag`, { headers: { Authorization: `Bearer ${login.body.token}` } });
    check("普通用户访问管理员接口返回 403", admin.response.status === 403, `status=${admin.response.status}`);
    const migration = await fetch(`${baseUrl}/api/migrate-city`);
    check("不公开的迁移接口返回 404", migration.status === 404, `status=${migration.status}`);
    const debug = await fetch(`${baseUrl}/api/debug`);
    check("不公开的调试接口返回 404", debug.status === 404, `status=${debug.status}`);
  } finally {
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
      check("测试完成后关闭服务", true, `port=${port}`);
      check("不遗留端口占用", await isPortClosed(port), `port=${port}`);
    }
  }
  const failed = results.filter((result) => result.status === "FAIL");
  console.log(`SUMMARY | passed=${results.length - failed.length} failed=${failed.length} total=${results.length}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`SMOKE TEST FAILED | ${error.stack || error.message}`);
  process.exitCode = 1;
});