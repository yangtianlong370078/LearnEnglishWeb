/**
 * 适配 .NET 10 WebApi 统一返回结构
 */
export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  msg: string;
  success: boolean;
}

/**
 * 分页请求参数
 */
export interface PageParams {
  pageIndex: number;
  pageSize: number;
}

/**
 * 分页响应数据
 */
export interface PageData<T> {
  items: T[];
  total: number;
  pageIndex: number;
  pageSize: number;
}

/**
 * 分页响应
 */
export type PageResponse<T> = ApiResponse<PageData<T>>;
