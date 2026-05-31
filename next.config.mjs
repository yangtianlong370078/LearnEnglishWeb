import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 显式指定项目根目录，避免 D:\codes 下多个 lockfile 触发误判
  turbopack: {
    root: __dirname,
  },
  /**
   * 本地开发环境代理：将 /api 请求转发到 .NET 10 WebApi
   * 注意：Next.js 16 的 rewrites 使用 undici，对自签名证书不友好。
   * 登录接口已通过 app/api/login/route.ts 中转，其他后端接口若有问题可参考同样方式。
   *
   * 修改 DOTNET_API_URL 以指向实际后端地址
   */
  async rewrites() {
    const backendUrl =
      process.env.DOTNET_API_URL ?? "https://localhost:6121";

    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

