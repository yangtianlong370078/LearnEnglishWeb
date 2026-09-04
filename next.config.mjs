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
   * 后端 API 通过 app/api/[...path]/route.ts 中转，
   * 规避 Next.js 16 rewrites 使用 undici 对自签证书不友好的问题。
   * 因此不再配置 rewrites。
   */
};

export default nextConfig;

