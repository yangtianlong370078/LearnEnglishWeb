import { NextRequest, NextResponse } from "next/server";

/** 不需要鉴权的路径前缀 */
const PUBLIC_PATHS = [
  "/login",
  "/_next",
  "/favicon.ico",
  "/api", // 接口代理请求不拦截
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("auth_token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // 匹配所有路径，但排除静态资源
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

// Next.js 16 要求同时有 default export
export default proxy;
