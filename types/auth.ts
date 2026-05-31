/**
 * 登录相关类型定义
 */

/** 用户信息 */
export interface UserInfo {
  id: number;
  age: number;
  loginid: string;
  phone: string;
  name: string;
  password: null | string;
  courseId: number;
  status: number;
  startdate: string;
  enddate: string;
}

/** 登录接口返回值（非标准 ApiResponse，token 在顶层） */
export interface LoginResponse {
  token: string;
  msg: string;
  user: UserInfo;
  success: boolean;
}

/** 登录请求参数 */
export interface LoginParams {
  loginID: string;
  password: string;
}
