/**
 * 课程模块接口
 * 对应后端 /api/Course 路由
 */
import type { MyCategoryContent } from "@/types/course";

import { get } from "../request";

/** 获取我的分类内容（课程分类 + 我的分类 + 生词本 + 强化学习） */
export function getMyCategoryContent(type = 1) {
  return get<MyCategoryContent>("/Course/MyCategoryContent", { type });
}
