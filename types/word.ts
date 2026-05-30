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

/** KPI 统计数据 */
export interface WordStats {
  /** 已掌握数量 */
  masteredCount: number;
  /** 学习中数量 */
  learningCount: number;
  /** 强化中数量 */
  reviewingCount: number;
  /** 总数 */
  totalCount: number;
  /** 本周学习数 */
  weeklyStudied: number;
  /** 整体完成率 0-1 */
  completionRate: number;
}
