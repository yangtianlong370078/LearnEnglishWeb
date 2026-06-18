/**
 * 鉴权模块接口
 * 对应后端 /api/Login 路由
 */
import type { LoginResponse, LoginParams } from "@/types/auth";

import request from "../request";

/**
 * 用户登录
 * 注意：
 * 1. 通过 Next.js 本地 Route Handler /api/login 转发，
 *    绕过 next.config rewrites 在 Next 16 + undici 下的自签名证书限制。
 * 2. .NET 后端使用默认模型绑定，简单类型参数需以 application/x-www-form-urlencoded
 *    格式提交，而非 JSON body。
 * 返回结构为 { token, msg, user, success }，与标准 ApiResponse 不同，
 * 直接使用原始 axios 实例请求。
 */
export async function login(params: LoginParams): Promise<LoginResponse> {
  const form = new URLSearchParams();

  form.append("loginID", params.loginID);
  form.append("password", params.password);

  const res = await request.post<LoginResponse>("/login", form, {
    baseURL: "/api",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  return res.data;
}
