/**
 * 单词模块业务类型定义
 * 对应后端 .NET 10 单词相关接口实体
 */

/** 单词掌握状态 */
export type WordStatus = "mastered" | "learning" | "reviewing";

/** 单词信息 */
export interface Word {
  id: number;
  word: string;
  phonetic?: string;
  translation: string;
  /** 例句 */
  example?: string;
  status: WordStatus;
  /** 收录时间（ISO 字符串） */
  createdAt: string;
  /** 最近学习时间（ISO 字符串） */
  lastStudiedAt?: string;
}

/** 单词列表查询参数 */
export interface WordQueryParams {
  keyword?: string;
  status?: WordStatus;
  pageIndex: number;
  pageSize: number;
}

/** KPI 统计数据（对应后端 StudyStatisticsDto） */
export interface WordStats {
  /** 已掌握数量 */
  masteredCount: number;
  /** 未熟练数量 */
  unskilledCount: number;
  /** 强化中数量 */
  reinforcementCount: number;
  /** 今日学习数量（前端根据 lastDate/lastCount 实时计算） */
  todayCount: number;
  /** 日均对比增长率（百分比，正数增长，负数减少；前端实时计算） */
  growthRate: number;
  /** 最早缓存记录的日期（ISO 字符串），用于计算日均学习量 */
  minDate?: string | null;
  /** 最近缓存记录的日期（ISO 字符串） */
  lastDate?: string | null;
  /** 最近缓存记录当天的学习数量 */
  lastCount?: number;
}
