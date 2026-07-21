"use strict";

// 完全离线的 Supabase Auth 契约测试：不访问网络，不写入真实数据库。
process.env.LOST_FOUND_SUPABASE_URL = "https://auth-contract.invalid";
process.env.LOST_FOUND_SUPABASE_SERVICE_ROLE_KEY = "sb_secret_contract-server-key";
process.env.LOST_FOUND_SUPABASE_ANON_KEY = "contract-anon-key";
process.env.LOST_FOUND_JWT_SECRET = "contract-test-jwt-secret-at-least-32-bytes";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const profiles = new Map();
const providerUsers = new Map();
const calls = [];

function userIdFor(email) {
  if (email === "alpha@example.com") return "11111111-1111-4111-8111-111111111111";
  if (email === "confirm@example.com") return "22222222-2222-4222-8222-222222222222";
  return "33333333-3333-4333-8333-333333333333";
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

global.fetch = async (url, options = {}) => {
  const parsed = new URL(url);
  const body = options.body ? JSON.parse(options.body) : {};
  calls.push({ url: parsed.pathname + parsed.search, method: options.method || "GET", body, headers: options.headers || {} });

  if (parsed.pathname === "/auth/v1/signup") {
    const id = userIdFor(body.email);
    const user = {
      id,
      email: body.email,
      email_confirmed_at: body.email === "confirm@example.com" ? null : new Date().toISOString(),
      user_metadata: body.data || {},
    };
    providerUsers.set(body.email, user);
    if (body.email === "confirm@example.com") return jsonResponse({ user, session: null });
    return jsonResponse({ user, session: { access_token: "provider-session-must-not-leak" } });
  }

  if (parsed.pathname === "/auth/v1/token" && parsed.searchParams.get("grant_type") === "password") {
    const user = providerUsers.get(body.email) || {
      id: userIdFor(body.email),
      email: body.email,
      email_confirmed_at: new Date().toISOString(),
      user_metadata: { nickname: body.email.split("@")[0] },
    };
    providerUsers.set(body.email, user);
    return jsonResponse({ user, access_token: "provider-session-must-not-leak" });
  }

  if (parsed.pathname === "/rest/v1/shiyun_users" && (options.method || "GET") === "GET") {
    const id = parsed.searchParams.get("id")?.replace(/^eq\./, "");
    return jsonResponse(profiles.has(id) ? [profiles.get(id)] : []);
  }

  if (parsed.pathname === "/rest/v1/shiyun_users" && options.method === "POST") {
    profiles.set(body.id, body);
    return jsonResponse([body], 201);
  }

  return jsonResponse({ message: "unexpected mock route" }, 500);
};

const authHandler = require("../api/auth");

function invoke(action, body, ip) {
  return new Promise((resolve, reject) => {
    const req = {
      url: `/api/auth?action=${encodeURIComponent(action)}`,
      method: "POST",
      headers: { host: "localhost", "x-forwarded-for": ip },
      socket: { remoteAddress: ip },
      body,
    };
    const responseHeaders = {};
    const res = {
      statusCode: 200,
      setHeader(name, value) { responseHeaders[name.toLowerCase()] = value; },
      end(raw) {
        try {
          resolve({ status: this.statusCode, headers: responseHeaders, body: raw ? JSON.parse(raw) : {} });
        } catch (error) { reject(error); }
      },
    };
    Promise.resolve(authHandler(req, res)).catch(reject);
  });
}

function pass(name, detail = "") {
  console.log(`PASS | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function main() {
  const register = await invoke("password-register", {
    email: "Alpha@Example.com",
    password: "correct-horse-42",
    nickname: "账号甲",
  }, "auth-test-register");
  assert.equal(register.status, 200);
  assert.equal(register.body.user.id, "11111111-1111-4111-8111-111111111111");
  assert.equal(register.body.user.sub, register.body.user.id);
  assert.equal(register.body.user.provider, "password");
  assert.ok(register.body.token);
  pass("邮箱注册返回稳定的 Supabase Auth UUID");

  const serializedRegister = JSON.stringify(register.body);
  assert.ok(!serializedRegister.includes("correct-horse-42"));
  assert.ok(!serializedRegister.includes("provider-session-must-not-leak"));
  assert.ok(!serializedRegister.includes("contract-anon-key"));
  pass("应用响应不包含密码、Supabase 会话令牌或服务端 Key");

  const login = await invoke("password-login", {
    email: "alpha@example.com",
    password: "correct-horse-42",
  }, "auth-test-login");
  assert.equal(login.status, 200);
  assert.equal(login.body.user.id, register.body.user.id);
  assert.equal(login.body.user.nickname, "账号甲");
  pass("同一邮箱重新登录映射到同一业务用户");

  const secondLogin = await invoke("password-login", {
    email: "beta@example.com",
    password: "another-safe-42",
  }, "auth-test-second");
  assert.equal(secondLogin.status, 200);
  assert.notEqual(secondLogin.body.user.id, login.body.user.id);
  pass("不同邮箱获得相互独立的用户 ID");

  const confirmation = await invoke("password-register", {
    email: "confirm@example.com",
    password: "confirm-safe-42",
    nickname: "待验证账号",
  }, "auth-test-confirm");
  assert.equal(confirmation.status, 202);
  assert.equal(confirmation.body.confirmation_required, true);
  assert.ok(!confirmation.body.token);
  pass("启用邮箱确认时不提前签发应用登录令牌");

  const invalid = await invoke("password-register", {
    email: "not-an-email",
    password: "short",
    nickname: "无效账号",
  }, "auth-test-invalid");
  assert.equal(invalid.status, 400);
  pass("无效邮箱与弱长度密码在调用提供商前被拒绝");

  const guest = await invoke("guest-login", { nickname: "不应创建" }, "auth-test-guest");
  assert.equal(guest.status, 410);
  pass("配置 Supabase 后生产游客登录入口关闭");

  const providerCalls = calls.filter((call) => call.url.startsWith("/auth/v1/"));
  assert.ok(providerCalls.length >= 4);
  assert.ok(providerCalls.every((call) => call.headers.apikey === "contract-anon-key"));
  pass("Auth 请求优先使用服务端 anon key", `calls=${providerCalls.length}`);
  assert.ok(providerCalls.every((call) => !call.headers.Authorization));
  pass("新式 opaque Auth Key 不会被错误作为 Bearer JWT");

  delete process.env.LOST_FOUND_SUPABASE_ANON_KEY;
  const fallbackLogin = await invoke("password-login", {
    email: "server-fallback@example.com",
    password: "server-fallback-safe-42",
  }, "auth-test-server-fallback");
  assert.equal(fallbackLogin.status, 200);
  const fallbackProviderCall = calls.filter((call) => call.url.startsWith("/auth/v1/")).at(-1);
  assert.equal(fallbackProviderCall.headers.apikey, "sb_secret_contract-server-key");
  assert.ok(!fallbackProviderCall.headers.Authorization);
  process.env.LOST_FOUND_SUPABASE_ANON_KEY = "contract-anon-key";
  pass("仅配置 sb_secret 时作为 apikey 调用且不伪造 Bearer JWT");

  const root = path.resolve(__dirname, "..");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(html.includes('name="email"') && html.includes('name="password"'));
  assert.ok(html.includes("拾寻账号") && !html.includes("微信登录（Mock）") && !html.includes("游客登录"));
  assert.ok(html.includes("身份信息登记") && !html.includes('data-view-target="stats"') && !html.includes('id="view-stats"'));
  assert.ok(!html.includes("分数是演示排序分"));
  assert.ok(fs.existsSync(path.join(root, "docs", "evaluation", "evaluation-report.md")));
  pass("用户界面提供拾寻邮箱密码入口且移除微信/游客演示入口");

  const browserScript = fs.readFileSync(path.join(root, "script.js"), "utf8");
  assert.ok(browserScript.includes("password-${action}") && browserScript.includes("handlePasswordRegister") && browserScript.includes("handlePasswordLogin"));
  assert.ok(!browserScript.includes("autoLoginDemo") && !browserScript.includes("wechat-login"));
  assert.ok(!browserScript.includes("🔥 高排序候选"));
  pass("浏览器不再自动创建演示身份并调用新的账密接口");

  console.log("Supabase Auth 契约测试通过：12/12");
}

main().catch((error) => {
  console.error("FAIL | Supabase Auth 契约测试", error);
  process.exitCode = 1;
});
