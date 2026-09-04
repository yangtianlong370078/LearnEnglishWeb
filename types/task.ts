/**
 * 任务模块业务类型定义
 * 对应后端 .NET 10 任务相关接口实体
 */

/** 月份标识 */
export interface MonthValue {
  year: number;
  /** 月份 1-12 */
  month: number;
}

/** 月度任务完成情况（用于年历）*/
export interface MonthCompletion {
  year: number;
  /** 月份 1-12 */
  month: number;
  /** 完成百分比 0-100，null 表示无数据 */
  percent: number | null;
}

/** 每日学习统计 */
export interface StatisticsLearn {
  year: number;
  month: number;
  day: number;
  /** 当日学习单词数 */
  count: number;
}

/** 月度任务配置 */
export interface MonthlyTask {
  /** 本月任务总单词数 */
  count: number;
  /**
   * 排除周末模式
   * 0 = 不排除
   * 1 = 排除周六
   * 2 = 排除周日
   * 3 = 排除双休
   */
  weekend: 0 | 1 | 2 | 3;
}

/** 月度数据（对应接口返回） */
export interface MonthlyData {
  year: number;
  month: number;
  statisticsLearns: StatisticsLearn[];
  task: MonthlyTask | null;
}

/** 创建/更新月度任务请求体 */
export interface SaveMonthlyTaskRequest {
  year: number;
  month: number;
  count: number;
  weekend: 0 | 1 | 2 | 3;
}
