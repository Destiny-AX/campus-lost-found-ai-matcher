"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const required = [
  "index.html", "style.css", "script.js", "local-server.js", "package.json",
  "vercel.json", "supabase-schema.sql", ".env.example",
  "api/records.js", "api/analyze-image.js", "api/structured-input.js",
  "api/auth.js", "api/notify.js", "api/custody.js", "api/upload-image.js",
  "scripts/smoke-test.js", "scripts/heuristic-regression.js",
  "docs/verification/heuristic-regression-results.json", "docs/verification/heuristic-regression-summary.md",
];
const failures = [];

for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) failures.push(`缺少必需文件：${rel}`);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", ".git"].includes(entry.name)) return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = walk(root);
for (const file of files.filter((item) => item.endsWith(".js"))) {
  try {
    const source = fs.readFileSync(file, "utf8");
    // 只解析不执行，避免检查阶段调用外部 API 或启动服务。
    const parseable = source.includes("export default") ? source.replace("export default", "return") : source;
    new Function(parseable);
  } catch (error) {
    failures.push(`JavaScript 语法错误：${path.relative(root, file)}\n${error.message}`);
  }
}

const textExtensions = new Set([".js", ".json", ".html", ".css", ".sql", ".md", ".yaml", ".yml", ".toml", ".txt"]);
const secretPatterns = [
  { name: "疑似 OpenAI/兼容 API Key", regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: "疑似 JWT", regex: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g },
  { name: "疑似硬编码 Supabase Key", regex: /(?:service_role|anon)["']?\s*[:=]\s*["'][A-Za-z0-9_-]{40,}["']/gi },
];
for (const file of files) {
  if (path.basename(file) === "package-lock.json" || !textExtensions.has(path.extname(file).toLowerCase())) continue;
  const content = fs.readFileSync(file, "utf8");
  for (const pattern of secretPatterns) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(content)) failures.push(`${pattern.name}：${path.relative(root, file)}`);
  }
}

const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
for (const section of ["dependencies", "devDependencies"]) {
  if (Object.keys(packageJson[section] || {}).length) failures.push(`${section} 仍包含业务未使用的外部依赖`);
}
if (Object.values(packageJson.scripts || {}).some((command) => /vercel\s+--prod/i.test(command))) {
  failures.push("package.json 仍包含可误触生产部署的 vercel --prod 脚本");
}
for (const requiredEnv of ["LOST_FOUND_SUPABASE_URL", "LOST_FOUND_SUPABASE_SERVICE_ROLE_KEY", "LOST_FOUND_SILICON_FLOW_API_KEY", "LOST_FOUND_JWT_SECRET"]) {
  if (!fs.readFileSync(path.join(root, ".env.example"), "utf8").includes(`${requiredEnv}=`)) failures.push(`.env.example 缺少兼容变量：${requiredEnv}`);
}
if ((vercel.routes || []).some((route) => route.src === "/api/migrate-city")) {
  failures.push("破坏性迁移接口仍暴露在 Vercel 路由中");
}

if (failures.length) {
  console.error("项目检查失败：\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log(`项目检查通过：${required.length} 个必需文件、${files.filter((f) => f.endsWith(".js")).length} 个 JavaScript 文件，未发现常见硬编码密钥。`);
