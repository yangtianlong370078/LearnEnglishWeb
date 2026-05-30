/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * 本地开发环境代理：将 /api 请求转发到 .NET 10 WebApi
   * 生产环境由服务器 / Nginx 负责跨域及反向代理
   *
   * 修改 DOTNET_API_URL 以指向实际后端地址
   */
  async rewrites() {
    const backendUrl =
      process.env.DOTNET_API_URL ?? "http://localhost:5000";

    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

