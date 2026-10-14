import { NextRequest, NextResponse } from "next/server";

/**
 * 登录代理：在 Next.js 服务端转发到 .NET 后端 
 *
 * 为什么不用 next.config.mjs 的 rewrites？
 * Next.js 16 的 rewrites 内部使用 undici，对自签名证书的 NODE_TLS_REJECT_UNAUTHORIZED=0
 * 不再生效，因此通过此 Route Handler 用 Node 原生 fetch 转发。
 */
const BACKEND_URL = process.env.DOTNET_API_URL ?? "https://localhost:6121";
const AUTH_COOKIE = "auth_token";

interface LoginProxyResponse {
  token?: string;
  success?: boolean;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const search = req.nextUrl.search; // 透传 query string

  try {
    const upstream = await fetch(
      `${BACKEND_URL}/api/Login/LoginResult${search}`,
      {
        method: "POST",
        headers: {
          "Content-Type": req.headers.get("content-type") ?? "application/json",
        },
        body: body || undefined,
      },
    );

    const text = await upstream.text();
    const response = new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") ?? "application/json",
      },
    });

    try {
      const data = JSON.parse(text) as LoginProxyResponse;

      if (upstream.ok && data.success !== false && data.token) {
        response.cookies.set(AUTH_COOKIE, data.token, {
          httpOnly: true,
          maxAge: 60 * 60 * 24 * 7,
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
      }
    } catch {
      // Non-JSON upstream responses are passed through unchanged.
    }

    return response;
  } catch (err) {
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
