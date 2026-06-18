/**
 * 任务模块接口
 * 对应后端 /api/Task 路由
 */
import type {
  MonthlyData,
  MonthCompletion,
  SaveMonthlyTaskRequest,
} from "@/types/task";

import { get, post } from "../request";

/** 获取指定月份的任务与学习统计 */
export function getMonthlyData(year: number, month: number) {
  return get<MonthlyData>("/Task/monthly", { year, month });
}

/** 获取全年各月完成情况（用于年历） */
export function getYearStats(year: number) {
  return get<MonthCompletion[]>("/Task/year-stats", { year });
}

/** 创建或更新月度任务 */
export function saveMonthlyTask(data: SaveMonthlyTaskRequest) {
  return post<void>("/Task/monthly", data);
}
