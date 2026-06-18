/**
 * 接口全局配置
 * 适配 .NET 10 WebApi
 */

/** 接口基础地址（生产环境从环境变量读取，本地开发通过 next.config.mjs 代理转发） */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

/** 请求超时时间（ms） */
export const REQUEST_TIMEOUT = 15_000;

/** OSS 静态资源基础地址 */
export const OSS_BASE_URL =
  process.env.NEXT_PUBLIC_OSS_BASE_URL ??
  "https://marketimages.oss-cn-shanghai.aliyuncs.com";

/** .NET 10 后端业务状态码约定 */
export const ApiCode = {
  SUCCESS: 200,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
} as const;
