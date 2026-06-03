/**
 * Axios 二次封装
 * 适配 .NET 10 WebApi 统一返回结构、JWT 鉴权、全局异常处理
 */
import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

import type { ApiResponse } from "@/types/api";
import { API_BASE_URL, ApiCode, REQUEST_TIMEOUT } from "./config";

const request: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

// ── 请求拦截器：自动携带 JWT Token ─────────────────────────────
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 从 localStorage 读取 token（客户端）
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── 响应拦截器：适配 .NET 10 返回结构、全局异常处理 ──────────────
request.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    // 304 Not Modified：无响应体，直接放行交由调用方复用本地缓存
    if (response.status === 304) {
      return response;
    }

    const res = response.data;

    // .NET 接口业务层错误
    if (!res.success) {
      return Promise.reject(new Error(res.msg ?? "请求失败"));
    }

    return response;
  },
  (error) => {
    const status: number | undefined = error.response?.status;

    switch (status) {
      case ApiCode.UNAUTHORIZED:
        // Token 失效，清除本地凭证并跳转登录
        if (typeof window !== "undefined") {
          localStorage.removeItem("token");
          document.cookie = "auth_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
          window.location.href = "/login";
        }
        break;
      case ApiCode.FORBIDDEN:
        return Promise.reject(new Error("权限不足，无法执行此操作"));
      case ApiCode.NOT_FOUND:
        return Promise.reject(new Error("请求的资源不存在"));
      case ApiCode.SERVER_ERROR:
        return Promise.reject(new Error("服务器内部错误，请稍后重试"));
      case 502:
        // eslint-disable-next-line no-console
        console.error("[api] 502 响应体:", error.response?.data);
        return Promise.reject(new Error("网关错误，请检查后端服务是否正常运行"));
      default:
        break;
    }

    return Promise.reject(error);
  },
);

// ── 封装请求方法，直接返回 data 层数据 ────────────────────────────

export async function get<T>(
  url: string,
  params?: Record<string, unknown>,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await request.get<ApiResponse<T>>(url, { params, ...config });
  return res.data.data;
}

export async function post<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await request.post<ApiResponse<T>>(url, data, config);
  return res.data.data;
}

export async function put<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await request.put<ApiResponse<T>>(url, data, config);
  return res.data.data;
}

export async function del<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await request.delete<ApiResponse<T>>(url, config);
  return res.data.data;
}

export default request;
