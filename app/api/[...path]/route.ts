import { NextRequest, NextResponse } from "next/server";

/**
 * 通用后端代理（Catch-all Route Handler）
 *
 * 转发 /api/* 到 .NET 后端。规避 Next.js 16 rewrites 使用 undici 时
 * 无法识别 NODE_TLS_REJECT_UNAUTHORIZED=0 的自签名证书问题。
 *
 * 注意：更具体的路由（如 /api/login/route.ts）会优先匹配，本路由作为兜底。
 */
const BACKEND_URL = process.env.DOTNET_API_URL ?? "https://localhost:6121";

/** 不应透传到后端的请求头 */
const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "content-length",
]);

/**
 * 不应透传给浏览器的响应头。
 * - content-encoding / content-length：Node fetch (undici) 已经把
 *   gzip/br 自动解压成明文 body，再把原始 Content-Encoding 透传给浏览器
 *   会导致浏览器二次解码失败（表现为 axios Network Error）。
 */
const RESPONSE_STRIP = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
]);

function buildHeaders(req: NextRequest): HeadersInit {
  const headers: Record<string, string> = {};

  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers[key] = value;
    }
  });

  return headers;
}

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const target = `${BACKEND_URL}/api/${path.join("/")}${req.nextUrl.search}`;

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: buildHeaders(req),
      body,
    });

    const respHeaders = new Headers();

    upstream.headers.forEach((value, key) => {
      if (!RESPONSE_STRIP.has(key.toLowerCase())) {
        respHeaders.set(key, value);
      }
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: respHeaders,
    });
  } catch (err) {
    // 打印真实错误，方便在 Next.js 服务端终端定位问题
    console.error("[proxy] fetch 失败", { target, method: req.method }, err);
    return NextResponse.json(
      {
        success: false,
        msg:
          err instanceof Error
            ? `代理失败：${err.message}`
            : "代理后端接口失败",
      },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
export const OPTIONS = proxy;
