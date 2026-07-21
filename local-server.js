"use strict";

// 本地开发服务器 v2
// 端口 4173，路由 /api/* 到对应处理器，其他走静态文件

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;

// API 路由表
const apiRoutes = {
  "/api/records": require("./api/records"),
  "/api/analyze-image": require("./api/analyze-image"),
  "/api/auth": require("./api/auth"),
  "/api/structured-input": require("./api/structured-input"),
  "/api/notify": require("./api/notify"),
  "/api/custody": require("./api/custody"),
  "/api/upload-image": require("./api/upload-image"),
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

function createServer() {
  return http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const handler = apiRoutes[url.pathname];
    if (handler) {
      await handler(req, res);
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      sendJson(res, 404, { error: "API route not found" });
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }
    serveStatic(url.pathname, res, req.method === "HEAD");
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Internal server error" });
  }
});
}

function startServer(port = PORT) {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      const actualPort = server.address().port;
      console.log(`拾寻 AI 产品求职优化版已启动：http://localhost:${actualPort}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer().catch((error) => { console.error(error); process.exitCode = 1; });
}

function serveStatic(pathname, res, headOnly) {
  let decodedPathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch (error) {
    sendJson(res, 400, { error: "Invalid URL encoding" });
    return;
  }
  const normalized = decodedPathname === "/" ? "/index.html" : decodedPathname;
  const filePath = path.normalize(path.join(ROOT, normalized));
  // 统一大小写并确保路径分隔符一致，防止 Windows 路径遍历绕过
  const rootResolved = path.resolve(ROOT).toLowerCase().replace(/\\/g, "/");
  const fileResolved = path.resolve(filePath).toLowerCase().replace(/\\/g, "/");
  if (!fileResolved.startsWith(rootResolved)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      // SPA fallback：对未知 GET 路径返回 index.html
      if (!decodedPathname.includes(".")) {
        fs.readFile(path.join(ROOT, "index.html"), (e2, html) => {
          if (e2) return sendJson(res, 404, { error: "Not found" });
          res.writeHead(200, { "Content-Type": mimeTypes[".html"] });
          res.end(headOnly ? undefined : html);
        });
        return;
      }
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    const type = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(headOnly ? undefined : data);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

module.exports = { createServer, startServer };
