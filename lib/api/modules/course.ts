/**
 * 课程模块接口
 * 对应后端 /api/Course 路由
 */
import type {
  AvailableCategoryInfo,
  MyCategoryContent,
} from "@/types/course";

import { get, post } from "../request";

/** 获取我的分类内容（课程分类 + 我的分类 + 生词本 + 强化学习） */
export function getMyCategoryContent(type = 1) {
  return get<MyCategoryContent>("/Course/MyCategoryContent", { type });
}

/** 获取尚未加入当前用户学习列表的课程 */
export function getCategoryList(type = 1) {
  return get<AvailableCategoryInfo[]>("/Course/CategoryList", { type });
}

/** 将课程加入当前用户的学习列表 */
export function insertMyCourse(setcourseId: number) {
  return post<void>("/Course/InsertMyCourse", null, {
    params: { setcourseId },
  });
}

/**
 * 保存/编辑课程
 * @param setcourseId 新增传 0；编辑传当前课程 id
 * @param insercoursename 课程名称
 * @param type 课程类型，默认 1
 */
export function saveCourse(
  setcourseId: number,
  insercoursename: string,
  type = 1,
) {
  return post<void>("/Course/SaveCourse", null, {
    params: { setcourseId, insercoursename, type },
  });
}

/**
 * 删除课程
 * @param setcourseId 当前选择的课程 id
 */
export function deleteCourse(setcourseId: number) {
  return post<void>("/Course/deleteCourse", null, {
    params: { setcourseId },
  });
}
