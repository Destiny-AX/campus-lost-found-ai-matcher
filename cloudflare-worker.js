/**
 * 拾寻 - Cloudflare Worker 反向代理
 * 作用：国内用户访问此 Worker → Worker 回源 Vercel
 * 部署后得到 xxx.workers.dev 域名，国内可直接访问
 */

const VERCEL_ORIGIN = "https://shixun-lost-found.vercel.app";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    // 构造回源 URL（保持路径和查询参数）
    const originUrl = VERCEL_ORIGIN + url.pathname + url.search;

    // 复制原始请求头，修改 Host
    const headers = new Headers(request.headers);
    headers.set("Host", "shixun-lost-found.vercel.app");
    headers.set("X-Forwarded-Host", url.hostname);

    // 处理 OPTIONS 预检请求（跨域 POST 前置请求）
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // 构造回源请求：先读取 body 再传递，避免 ReadableStream 直接转发导致 body 丢失
    let bodyData = undefined;
    if (request.method !== "GET" && request.method !== "HEAD") {
      // 读取为 ArrayBuffer 后再传递，确保 body 完整转发到 Vercel
      bodyData = await request.arrayBuffer();
      // 如果 body 为空，则不传递
      if (bodyData.byteLength === 0) {
        bodyData = undefined;
      }
    }

    const originRequest = new Request(originUrl, {
      method: request.method,
      headers: headers,
      body: bodyData,
      redirect: "manual",
    });

    // 发起回源请求
    const response = await fetch(originRequest);

    // 复制响应头，移除可能引起问题的头
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("set-cookie");
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  },
};
