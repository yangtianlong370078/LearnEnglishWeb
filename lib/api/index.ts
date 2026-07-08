/**
 * API 模块统一导出
 */
export * as taskApi from "./modules/task";
export * as wordApi from "./modules/word";
export * as authApi from "./modules/auth";
export * as statisticsApi from "./modules/statistics";
export * as courseApi from "./modules/course";
export { get, post, put, del } from "./request";
